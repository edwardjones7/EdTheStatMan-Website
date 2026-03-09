'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { AccessLevel } from '@/lib/supabase/types'

const TAGS = ['NFL', 'NBA', 'College Football', 'College Basketball', 'Education', 'Strategy', 'General']

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

interface Props {
  post?: {
    id: string
    title: string
    slug: string
    content: string
    excerpt: string | null
    tag: string
    access_level: AccessLevel
    published: boolean
  }
}

export default function PostEditorClient({ post }: Props) {
  const router = useRouter()
  const isEdit = !!post

  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [tag, setTag] = useState(post?.tag ?? 'General')
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(post?.access_level ?? 'free')
  const [published, setPublished] = useState(post?.published ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: post?.content ?? '',
    editorProps: {
      attributes: {
        class: 'post-editor__content',
      },
    },
  })

  const activeState = useEditorState({
    editor,
    selector: (ctx) => ({
      bold:        ctx.editor?.isActive('bold') ?? false,
      italic:      ctx.editor?.isActive('italic') ?? false,
      h2:          ctx.editor?.isActive('heading', { level: 2 }) ?? false,
      h3:          ctx.editor?.isActive('heading', { level: 3 }) ?? false,
      bulletList:  ctx.editor?.isActive('bulletList') ?? false,
      orderedList: ctx.editor?.isActive('orderedList') ?? false,
      blockquote:  ctx.editor?.isActive('blockquote') ?? false,
      code:        ctx.editor?.isActive('code') ?? false,
    }),
  })

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)
    if (!slugTouched) {
      setSlug(slugify(val))
    }
  }, [slugTouched])

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true)
    setSlug(slugify(e.target.value))
  }, [])

  async function save(shouldPublish: boolean) {
    if (!title.trim() || !slug.trim()) {
      setError('Title and slug are required.')
      return
    }
    if (!editor?.getText().trim()) {
      setError('Content cannot be empty.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      content: editor.getHTML(),
      excerpt: excerpt.trim() || null,
      tag,
      access_level: accessLevel,
      published: shouldPublish,
    }

    const res = await fetch(
      isEdit ? `/api/admin/posts/${post!.id}` : '/api/admin/posts',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }

    router.push('/admin')
    router.refresh()
  }

  async function handleDelete() {
    if (!post) return
    if (!confirm('Delete this post? This cannot be undone.')) return
    setSaving(true)
    const res = await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Delete failed.')
      setSaving(false)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="admin-page">
      <div className="admin-container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">{isEdit ? 'Edit Post' : 'New Post'}</h1>
            <p className="admin-header__sub">
              {isEdit ? `Editing: ${post!.slug}` : 'Create a new blog post'}
            </p>
          </div>
          <button
            className="btn btn--outline btn--sm"
            onClick={() => router.back()}
            disabled={saving}
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="post-editor__error">{error}</div>
        )}

        <div className="post-editor__layout">
          {/* Main content area */}
          <div className="post-editor__main">
            {/* Title */}
            <div className="post-editor__field">
              <label className="post-editor__label">Title</label>
              <input
                className="post-editor__input"
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Post title…"
              />
            </div>

            {/* Slug */}
            <div className="post-editor__field">
              <label className="post-editor__label">Slug</label>
              <div className="post-editor__slug-wrap">
                <span className="post-editor__slug-prefix">/blog/</span>
                <input
                  className="post-editor__input post-editor__input--slug"
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="post-slug"
                />
              </div>
            </div>

            {/* Excerpt */}
            <div className="post-editor__field">
              <label className="post-editor__label">Excerpt <span className="post-editor__optional">(optional)</span></label>
              <textarea
                className="post-editor__textarea"
                value={excerpt}
                onChange={e => setExcerpt(e.target.value)}
                placeholder="Short summary shown in blog listings…"
                rows={3}
              />
            </div>

            {/* Rich text editor */}
            <div className="post-editor__field">
              <label className="post-editor__label">Content</label>
              <div className="post-editor__toolbar">
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.bold ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  title="Bold"
                >B</button>
                <button
                  type="button"
                  className={`post-editor__tool post-editor__tool--italic${activeState?.italic ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  title="Italic"
                >I</button>
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.h2 ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  title="Heading 2"
                >H2</button>
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.h3 ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                  title="Heading 3"
                >H3</button>
                <span className="post-editor__tool-divider" />
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.bulletList ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  title="Bullet list"
                >• List</button>
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.orderedList ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  title="Ordered list"
                >1. List</button>
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.blockquote ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  title="Blockquote"
                >" Quote</button>
                <button
                  type="button"
                  className={`post-editor__tool${activeState?.code ? ' post-editor__tool--active' : ''}`}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                  title="Inline code"
                >{`<>`} Code</button>
                <span className="post-editor__tool-divider" />
                <button
                  type="button"
                  className="post-editor__tool"
                  onClick={() => editor?.chain().focus().undo().run()}
                  title="Undo"
                >Undo</button>
                <button
                  type="button"
                  className="post-editor__tool"
                  onClick={() => editor?.chain().focus().redo().run()}
                  title="Redo"
                >Redo</button>
              </div>
              <EditorContent editor={editor} className="post-editor__editor-wrap" />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="post-editor__sidebar">
            {/* Publish actions */}
            <div className="post-editor__card">
              <div className="post-editor__card-title">Publish</div>
              <div className="post-editor__status-row">
                <span className="post-editor__label">Status</span>
                <span className={`admin-badge ${published ? 'admin-badge--green' : 'admin-badge--muted'}`}>
                  {published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="post-editor__actions">
                <button
                  className="btn btn--outline btn--sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => save(false)}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button
                  className="btn btn--primary btn--sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => save(true)}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : published ? 'Update' : 'Publish'}
                </button>
              </div>
              {isEdit && (
                <button
                  className="post-editor__delete-btn"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete post
                </button>
              )}
            </div>

            {/* Tag */}
            <div className="post-editor__card">
              <div className="post-editor__card-title">Tag / Sport</div>
              <div className="post-editor__tag-grid">
                {TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`post-editor__tag-btn${tag === t ? ' post-editor__tag-btn--active' : ''}`}
                    onClick={() => setTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Access level */}
            <div className="post-editor__card">
              <div className="post-editor__card-title">Access Level</div>
              <div className="post-editor__access-group">
                <label className="post-editor__radio-label">
                  <input
                    type="radio"
                    name="access_level"
                    value="free"
                    checked={accessLevel === 'free'}
                    onChange={() => setAccessLevel('free')}
                  />
                  <span>Free</span>
                  <span className="post-editor__access-desc">Visible to all logged-in users</span>
                </label>
                <label className="post-editor__radio-label">
                  <input
                    type="radio"
                    name="access_level"
                    value="members"
                    checked={accessLevel === 'members'}
                    onChange={() => setAccessLevel('members')}
                  />
                  <span>Members only</span>
                  <span className="post-editor__access-desc">Basic & Premium subscribers</span>
                </label>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
