'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useCreateReview,
  useReviewPlatforms,
  useReviews,
} from '@/features/reviews/hooks/use-reviews';

/**
 * Review list (M16) — rating, platform, contact, and a needs-attention badge
 * for ratings below the feedback threshold. A create-review doorway records a
 * review manually (the E2E-verifiable path while the platform APIs are stubs).
 */

export const REVIEW_FILTERS = ['all', 'needs-attention'] as const;

export function ReviewList() {
  const [status, setStatus] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, isError, refetch } = useReviews(status);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading reviews" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter reviews">
          {REVIEW_FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value)}
            >
              {value === 'all' ? 'All' : 'Needs attention'}
            </Button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)}>New review</Button>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title={status === 'all' ? 'No reviews yet' : 'Nothing needs attention'}
          description="Reviews appear here as customers respond to review requests."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {'★'.repeat(review.rating)}
                  <span className="text-muted-foreground">
                    {'★'.repeat(5 - review.rating)}
                  </span>
                  <span className="text-muted-foreground ms-2 text-xs">
                    {review.platformName}
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {review.text ?? 'No comment'}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {review.contactDisplayName}
                </p>
              </div>
              {review.needsAttention ? (
                <Badge variant="destructive">Needs attention</Badge>
              ) : (
                <Badge variant="secondary">Positive</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateReviewDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateReviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateReview();
  const platforms = useReviewPlatforms();

  const [contactId, setContactId] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');

  const submit = () => {
    const parsed = Number(rating);
    if (
      !contactId ||
      !platformId ||
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > 5
    ) {
      return;
    }
    create.mutate(
      {
        contactId,
        platformId,
        rating: parsed,
        text: text.trim() || undefined,
      },
      {
        onSuccess: () => {
          setContactId('');
          setPlatformId('');
          setRating('5');
          setText('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New review</DialogTitle>
          <DialogDescription>
            Record a review received from a customer. Ratings below 4 are flagged as
            needing attention.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="review-contact">Contact id</Label>
            <Input
              id="review-contact"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              placeholder="The contact's UUID"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-platform">Platform</Label>
            <Select value={platformId} onValueChange={setPlatformId}>
              <SelectTrigger id="review-platform" className="w-full">
                <SelectValue placeholder="Choose a platform" />
              </SelectTrigger>
              <SelectContent>
                {(platforms.data?.platforms ?? []).map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-rating">Rating</Label>
            <Input
              id="review-rating"
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-text">Comment (optional)</Label>
            <Textarea
              id="review-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not record the review.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!contactId || !platformId || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Saving…' : 'Save review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
