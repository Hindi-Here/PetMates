import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const STORAGE_PREFIX = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`

const MAX_WIDTH_PX = 1200
const MAX_HEIGHT_PX = 1200
const MIN_SIZE_PX = 16

const parseSize = (value: unknown, max: number, allowPercent: boolean): number | string | undefined => {
  if (value === undefined || value === null) return undefined
  const s = String(value).trim()

  const pct = /^(\d{1,3})%$/.exec(s)
  if (pct && allowPercent) return `${Math.min(Math.max(Number(pct[1]), 5), 100)}%`

  if (/^\d{1,5}$/.test(s)) return Math.min(Math.max(Number(s), MIN_SIZE_PX), max)

  return undefined
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [
      'src', 'alt', 'title', 'width', 'height',
      ['dataAlign', 'left', 'center', 'right'],
      ['dataFit', 'contain', 'cover'],
    ],
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
      img: ({ src, alt, title, width, height, ...rest }: any) => {
        if (typeof src !== 'string' || !src.startsWith(STORAGE_PREFIX)) return null
        return (
          <img
            src={src}
            alt={typeof alt === 'string' ? alt : ''}
            title={typeof title === 'string' ? title : undefined}
            width={parseSize(width, MAX_WIDTH_PX, true)}
            height={parseSize(height, MAX_HEIGHT_PX, false)}
            data-align={rest['data-align']}
            data-fit={rest['data-fit']}
            loading='lazy'
            decoding='async'
          />
        )
      },
      a: ({ href, children }: any) =>
        <a href={href} target='_blank' rel='noopener noreferrer nofollow'>{children}</a>,
    }}
  >
    {children}
  </ReactMarkdown>
)