// Sanitiseur SVG strict pour les icônes de points de repère.
//
// Pourquoi maison plutôt qu'une lib (DOMPurify + jsdom) : on accepte
// uniquement un sous-ensemble très réduit du SVG (icônes mono-couleur),
// et la lib + son DOM virtuel pèseraient lourd côté serveur pour ce besoin.
// Le sanitiseur est volontairement allowlist-only — tout ce qui n'est pas
// explicitement autorisé est rejeté.
//
// Garantie principale : le SVG retourné peut être inliné dans le DOM
// (innerHTML) sans risque XSS. Les couleurs `fill` / `stroke` non-`none`
// sont remplacées par `currentColor` pour permettre le contrôle via CSS
// `color`.

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'linearGradient', 'radialGradient', 'stop',
  'clipPath', 'mask'
])

// Attributs autorisés par tag. `*` s'applique à tous les tags.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set([
    'id', 'class', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
    'stroke-dashoffset', 'stroke-opacity', 'fill-opacity', 'fill-rule',
    'opacity', 'transform', 'clip-path', 'mask', 'clip-rule'
  ]),
  'svg': new Set([
    'xmlns', 'viewBox', 'preserveAspectRatio', 'width', 'height',
    'version'
  ]),
  'path': new Set(['d']),
  'rect': new Set(['x', 'y', 'width', 'height', 'rx', 'ry']),
  'circle': new Set(['cx', 'cy', 'r']),
  'ellipse': new Set(['cx', 'cy', 'rx', 'ry']),
  'line': new Set(['x1', 'y1', 'x2', 'y2']),
  'polyline': new Set(['points']),
  'polygon': new Set(['points']),
  'linearGradient': new Set(['x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform', 'spreadMethod']),
  'radialGradient': new Set(['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform', 'spreadMethod']),
  'stop': new Set(['offset', 'stop-color', 'stop-opacity']),
  'clipPath': new Set(['clipPathUnits']),
  'mask': new Set(['maskUnits', 'maskContentUnits', 'x', 'y', 'width', 'height'])
}

// Tokenizer minimal : sépare le SVG en balises et texte. Volontairement
// strict — refuse les CDATA, processing instructions, doctype, comments
// non standard, namespaces non-svg, etc.
type Token
  = | { kind: 'open', tag: string, attrs: Record<string, string>, selfClose: boolean }
    | { kind: 'close', tag: string }
    | { kind: 'text', content: string }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    if (input[i] === '<') {
      // Refus systématique des constructions dangereuses
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i + 4)
        if (end === -1) throw new Error('Commentaire SVG non terminé')
        i = end + 3
        continue
      }
      if (input.startsWith('<![CDATA[', i)) {
        throw new Error('CDATA interdit dans les SVG')
      }
      if (input.startsWith('<!', i) || input.startsWith('<?', i)) {
        // DOCTYPE et processing instructions (incl. <?xml ?>) — on ignore.
        const end = input.indexOf('>', i)
        if (end === -1) throw new Error('Déclaration SVG non terminée')
        i = end + 1
        continue
      }
      const closing = input[i + 1] === '/'
      const tagStart = closing ? i + 2 : i + 1
      // Trouve la fin de la balise en respectant les guillemets d'attribut
      let j = tagStart
      let inQuote: '"' | '\'' | null = null
      while (j < input.length) {
        const ch = input[j]
        if (inQuote) {
          if (ch === inQuote) inQuote = null
        } else {
          if (ch === '"' || ch === '\'') inQuote = ch as '"' | '\''
          else if (ch === '>') break
        }
        j++
      }
      if (j >= input.length) throw new Error('Balise SVG non terminée')
      const inner = input.slice(tagStart, j)
      i = j + 1

      if (closing) {
        tokens.push({ kind: 'close', tag: inner.trim().toLowerCase() })
        continue
      }

      const selfClose = inner.endsWith('/')
      const body = selfClose ? inner.slice(0, -1) : inner
      // Premier mot = nom de tag, reste = attributs
      const m = /^\s*([a-zA-Z][a-zA-Z0-9-]*)\s*([\s\S]*)$/.exec(body)
      if (!m || !m[1]) throw new Error('Balise SVG malformée')
      const tag = m[1].toLowerCase()
      const attrs = parseAttrs(m[2] ?? '')
      tokens.push({ kind: 'open', tag, attrs, selfClose })
    } else {
      // Texte hors balise — on cumule jusqu'au prochain '<'
      const next = input.indexOf('<', i)
      const end = next === -1 ? input.length : next
      const text = input.slice(i, end)
      if (text.trim().length > 0) tokens.push({ kind: 'text', content: text })
      i = end
    }
  }
  return tokens
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  // Pattern volontairement strict : nom=valeur entre guillemets simples ou doubles.
  // Refus implicite des attributs sans guillemets (qui seraient dangereux).
  const re = /\s*([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const name = m[1]!.toLowerCase()
    const value = (m[3] ?? m[4] ?? '')
    out[name] = value
  }
  return out
}

function escapeXmlAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isAllowedAttr(tag: string, name: string): boolean {
  if (name.startsWith('on')) return false
  if (name === 'style') return false
  if (name.startsWith('xmlns:')) return false
  if (name.includes(':')) {
    // namespaces non gérés (xlink:href, etc.) — refus
    return false
  }
  return ALLOWED_ATTRS['*']!.has(name) || (ALLOWED_ATTRS[tag]?.has(name) ?? false)
}

function isColorValue(v: string): 'none' | 'color' {
  return v.trim().toLowerCase() === 'none' ? 'none' : 'color'
}

/**
 * Sanitise un SVG. Lance une erreur si rejet (XSS, balise interdite,
 * URL externe, …). Retourne une chaîne SVG normalisée :
 *   - une seule balise `<svg>` racine ;
 *   - aucune référence externe ;
 *   - les couleurs `fill` / `stroke` non-`none` sont remplacées par
 *     `currentColor` pour permettre la coloration via CSS `color`.
 */
export function sanitizeSvg(raw: string): string {
  const tokens = tokenize(raw)
  // Vérification de l'arbre : un seul `<svg>` racine, balises bien fermées.
  const stack: string[] = []
  let rootSeen = false
  let depth = 0

  const out: string[] = []
  for (const t of tokens) {
    if (t.kind === 'text') {
      // Texte autorisé seulement à l'intérieur de title/desc/stop (ignoré
      // ailleurs pour ne pas garder de bruit). On encode pour sûreté.
      const parent = stack[stack.length - 1]
      if (parent === 'title' || parent === 'desc' || parent === 'stop') {
        out.push(t.content.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
      }
      continue
    }
    if (t.kind === 'open') {
      if (!ALLOWED_TAGS.has(t.tag)) {
        throw new Error(`Balise <${t.tag}> non autorisée dans un SVG d'icône`)
      }
      if (t.tag === 'svg') {
        if (rootSeen) throw new Error('Plusieurs <svg> détectés — un seul autorisé')
        rootSeen = true
      } else if (depth === 0) {
        throw new Error(`Balise <${t.tag}> hors de la racine <svg>`)
      }

      // Filtre / réécrit les attributs
      const cleanAttrs: string[] = []
      // Pour la racine <svg> : on retire les attributs de dimensionnement
      // intrinsèques (width/height) afin que la taille en CSS du conteneur
      // (le pin Leaflet) pilote l'affichage. Si l'auteur n'a pas fourni de
      // `viewBox`, on en synthétise une à partir des width/height d'origine
      // pour préserver la mise à l'échelle des coordonnées internes.
      let svgWidthAttr: string | null = null
      let svgHeightAttr: string | null = null
      const isSvgRoot = t.tag === 'svg'
      for (const [name, value] of Object.entries(t.attrs)) {
        if (!isAllowedAttr(t.tag, name)) continue
        // Couleurs : non-`none` → `currentColor` pour autoriser la coloration CSS.
        if (name === 'fill' || name === 'stroke') {
          const v = isColorValue(value) === 'none' ? 'none' : 'currentColor'
          cleanAttrs.push(`${name}="${v}"`)
          continue
        }
        if (name === 'stop-color') {
          cleanAttrs.push(`${name}="currentColor"`)
          continue
        }
        // `xmlns` : seul namespace SVG accepté. Permet le namespace officiel
        // qui contient `http:` sans déclencher le check anti-URL ci-dessous.
        if (name === 'xmlns') {
          if (value.trim() !== 'http://www.w3.org/2000/svg') {
            throw new Error('xmlns invalide (seul le namespace SVG est accepté)')
          }
          cleanAttrs.push(`xmlns="http://www.w3.org/2000/svg"`)
          continue
        }
        // Sur la racine, on capture width/height pour synthèse de viewBox
        // mais on ne les ré-émet pas — le CSS du conteneur gère la taille.
        if (isSvgRoot && name === 'width') {
          svgWidthAttr = value
          continue
        }
        if (isSvgRoot && name === 'height') {
          svgHeightAttr = value
          continue
        }
        // Protections supplémentaires : pas d'URL absolue ou de javascript:
        if (/^(javascript|data|vbscript|file|http|https):/i.test(value)) {
          throw new Error(`URL externe interdite dans l'attribut ${name}`)
        }
        // Refus d'expression() (vieux IE) ou de url(...) hors fragment local.
        if (/url\s*\(\s*(?!#)/i.test(value)) {
          throw new Error(`url(...) externe interdite dans l'attribut ${name}`)
        }
        cleanAttrs.push(`${name}="${escapeXmlAttr(value)}"`)
      }

      if (isSvgRoot) {
        if (!t.attrs.xmlns) {
          cleanAttrs.unshift('xmlns="http://www.w3.org/2000/svg"')
        }
        // Synthèse d'un viewBox si absent (cas SVG exporté sans viewBox).
        // Sans cette étape, un SVG avec `width="620" height="572"` ne se
        // redimensionne pas — les coords internes restent en pixels absolus.
        if (!t.attrs.viewbox) {
          const w = svgWidthAttr ? Number.parseFloat(svgWidthAttr) : NaN
          const h = svgHeightAttr ? Number.parseFloat(svgHeightAttr) : NaN
          if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
            cleanAttrs.push(`viewBox="0 0 ${w} ${h}"`)
          }
        }
        // Force `fill="currentColor"` sur la racine si l'auteur n'a rien
        // précisé : `fill` est un attribut hérité par les enfants (sauf
        // ceux qui le redéfinissent), donc cela colore tous les `<path>`,
        // `<circle>`, etc. qui n'ont pas leur propre fill (sinon ils
        // défaillent en noir, indépendamment de `color` CSS).
        if (!t.attrs.fill) {
          cleanAttrs.push('fill="currentColor"')
        }
      }

      const opener = `<${t.tag}${cleanAttrs.length ? ' ' + cleanAttrs.join(' ') : ''}${t.selfClose ? '/>' : '>'}`
      out.push(opener)
      if (!t.selfClose) {
        stack.push(t.tag)
        depth++
      }
      continue
    }
    if (t.kind === 'close') {
      const top = stack.pop()
      if (top !== t.tag) {
        throw new Error(`Balise </${t.tag}> mal imbriquée (attendu </${top ?? '?'}>)`)
      }
      depth--
      out.push(`</${t.tag}>`)
      continue
    }
  }

  if (stack.length !== 0) throw new Error('SVG : balises non fermées')
  if (!rootSeen) throw new Error('Pas de racine <svg> trouvée')

  return out.join('')
}
