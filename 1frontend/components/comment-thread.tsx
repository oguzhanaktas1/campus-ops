'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useOptionalT } from '@/lib/optional-t'

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface CommentItem {
  id: string
  authorId?: string | null
  author: string
  authorRole: string
  content: string
  createdAt: string
}

interface CommentThreadProps {
  comments: CommentItem[]
  currentUserId?: string | null
  className?: string
  onAddComment?: (text: string) => void
}

export function CommentThread({ comments, currentUserId, className, onAddComment }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')
  const tt = useOptionalT()

  const handleSubmit = () => {
    if (!newComment.trim()) return
    onAddComment?.(newComment)
    setNewComment('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {tt('detail.noCommentsYet', 'No comments yet.')}
        </p>
      ) : (
        comments.map((comment) => {
          const isMine = !!currentUserId && comment.authorId === currentUserId
          return (
            <div
              key={comment.id}
              className={cn('flex gap-2 max-w-[85%]', isMine ? 'self-end flex-row-reverse' : 'self-start')}
            >
              <Avatar className="size-7 flex-shrink-0 mt-0.5">
                <AvatarFallback
                  className={cn(
                    'text-xs',
                    isMine
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10 text-primary',
                  )}
                >
                  {getInitials(comment.author)}
                </AvatarFallback>
              </Avatar>
              <div className={cn('min-w-0', isMine ? 'items-end' : 'items-start', 'flex flex-col')}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 mb-1 flex-wrap text-xs text-muted-foreground',
                    isMine ? 'flex-row-reverse' : '',
                  )}
                >
                  <span className="font-medium text-foreground">{isMine ? tt('detail.you', 'You') : comment.author}</span>
                  <span className="capitalize">{comment.authorRole}</span>
                  <span>{formatTimestamp(comment.createdAt)}</span>
                </div>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                    isMine
                      ? 'bg-primary/20 text-foreground rounded-tr-sm'
                      : 'bg-muted/60 text-foreground rounded-tl-sm',
                  )}
                >
                  {comment.content}
                </div>
              </div>
            </div>
          )
        })
      )}
      {onAddComment && (
        <div className="border-t border-border pt-4 space-y-2 mt-1">
          <Textarea
            placeholder={tt('detail.addCommentPlaceholder', 'Add a comment... (Ctrl+Enter to send)')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] resize-none"
          />
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim()}>
            {tt('detail.addComment', 'Add Comment')}
          </Button>
        </div>
      )}
    </div>
  )
}
