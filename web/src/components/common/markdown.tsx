import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const STORAGE_PREFIX = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: ['src', 'alt', 'width', 'height'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['https'],
    href: ['http', 'https', 'mailto'],
  },
}

export const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
    components={{
      img: ({ src, width, height }: any) =>
        typeof src === 'string' && src.startsWith(STORAGE_PREFIX)
          ? <img src={src} width={width} height={height} loading='lazy' decoding='async' />
          : null,
      a: ({ href, children }: any) =>
        <a href={href} target='_blank' rel='noopener noreferrer nofollow'>{children}</a>,
    }}
  >
    {children}
  </ReactMarkdown>
)