'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Comment } from '@/lib/mock-data'

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

interface CommentThreadProps {
  comments: Comment[]
  className?: string
  onAddComment?: (text: string) => void
}

export function CommentThread({ comments, className, onAddComment }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')

  const handleSubmit = () => {
    if (!newComment.trim()) return
    onAddComment?.(newComment)
    setNewComment('')
  }

  return (
    <div className={cn('space-y-4', className)}>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="size-8 flex-shrink-0 mt-0.5">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(comment.author)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-medium text-foreground">{comment.author}</span>
                <span className="text-xs text-muted-foreground capitalize">{comment.authorRole}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>
              </div>
            </div>
          </div>
        ))
      )}
      {onAddComment && (
        <div className="border-t border-border pt-4 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim()}>
            Add Comment
          </Button>
        </div>
      )}
    </div>
  )
}
