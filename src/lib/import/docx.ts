import mammoth from "mammoth";

/**
 * Import de fichier .docx → HTML propre (§20 Phase 2, tâche 10).
 * mammoth produit un HTML sémantique (h2-h4, p, ul/ol, table, blockquote,
 * img en data: URL) que `htmlToBlocks` convertit ensuite en blocs §06.4.
 *
 * styleMap : les styles Word français (« Titre 1 », « Titre 2 »…) sont
 * mappés sur les niveaux de titre intermédiaires — le H1 est rabattu en H2
 * par htmlToBlocks (le titre de l'article n'appartient pas au corps).
 */

const STYLE_MAP: string[] = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Titre'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Titre 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Titre 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Titre 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Titre 4'] => h4:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Citation'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Gras'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Italique'] => em",
];

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.readAsBase64String();
        return { src: `data:${image.contentType};base64,${base64}` };
      }),
    }
  );
  return result.value;
}
