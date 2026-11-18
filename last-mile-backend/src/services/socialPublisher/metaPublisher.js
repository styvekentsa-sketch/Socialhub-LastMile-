import { baseUrlFromEnv, PublishError, requestJson } from './httpClient.js';

// Page Facebook et compte Instagram professionnel du marchand (API Graph de Meta).
// Jetons envoyes dans l'en-tete Authorization, jamais dans l'URL.
// Version de l'API reglable (SOCIAL_META_GRAPH_VERSION) : Meta retire les versions au bout d'environ deux ans.
const graphBase = () => `${baseUrlFromEnv('SOCIAL_META_GRAPH_URL', 'https://graph.facebook.com')}/${process.env.SOCIAL_META_GRAPH_VERSION?.trim() || 'v23.0'}`;

const graphPost = (path, token, body, platformLabel) => requestJson(`${graphBase()}${path}`, {
  method: 'POST',
  headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}, { secrets: [token], platformLabel });

/**
 * Facebook : avec image, POST /{page-id}/photos { url, caption } (publication avec photo) ;
 * sans image, POST /{page-id}/feed { message, link }.
 */
export const publishToFacebook = async ({ credentials, post }) => {
  const { page_id: pageId, page_access_token: token } = credentials;
  const { json } = post.imageUrl
    ? await graphPost(`/${pageId}/photos`, token, { url: post.imageUrl, caption: post.text, published: true }, 'Facebook')
    : await graphPost(`/${pageId}/feed`, token, { message: post.text, link: post.productUrl }, 'Facebook');
  return { externalPostId: json?.post_id ?? json?.id ?? null };
};

/**
 * Instagram (compte professionnel relie a une page) : publication en deux temps.
 * 1. POST /{ig-user-id}/media { image_url, caption } -> conteneur ; 2. POST /{ig-user-id}/media_publish { creation_id }.
 * Instagram n'accepte pas de publication sans image.
 */
export const publishToInstagram = async ({ credentials, post }) => {
  if (!post.imageUrl) {
    throw new PublishError('Instagram exige une image publique : produit sans image accessible.');
  }
  const { ig_user_id: igUserId, access_token: token } = credentials;
  const { json: container } = await graphPost(`/${igUserId}/media`, token, { image_url: post.imageUrl, caption: post.text }, 'Instagram');
  if (!container?.id) {
    throw new PublishError('Instagram n\'a pas cree le conteneur de publication.');
  }
  const { json } = await graphPost(`/${igUserId}/media_publish`, token, { creation_id: container.id }, 'Instagram');
  return { externalPostId: json?.id ?? null };
};
