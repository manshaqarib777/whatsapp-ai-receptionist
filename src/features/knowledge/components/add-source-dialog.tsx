'use client';

import { Globe, HelpCircle, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateSource } from '@/features/knowledge/hooks/use-knowledge';

/**
 * "Add source" dialog with three tabs: upload, FAQ, website.
 *
 * `knowledge:write`. Submits to POST /api/knowledge/sources; FAQ ingests
 * synchronously, website enqueues a job.
 */

export function AddSourceDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateSource();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add source</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a knowledge source</DialogTitle>
          <DialogDescription>
            Upload a document, add FAQs, or ingest a website. Approved content is what the
            AI can cite.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload">
              <Upload aria-hidden="true" className="size-3.5" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle aria-hidden="true" className="size-3.5" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="website">
              <Globe aria-hidden="true" className="size-3.5" />
              Website
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadTab onDone={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="faq">
            <FaqTab onDone={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="website">
            <WebsiteTab onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function UploadTab({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);

    function submit(event: React.FormEvent) {
      event.preventDefault();
      if (!file) return;
      create.mutate(
        { kind: 'upload', name: name || file.name },
        {
          onSuccess: () => {
            toast.success('Upload queued — the worker will index it.');
            onDone();
          },
          onError: () => toast.error('Could not create the source.'),
        },
      );
    }

    return (
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="upload-name">Name</Label>
          <Input
            id="upload-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Policy handbook"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upload-file">File (PDF, DOCX, or CSV)</Label>
          <Input
            id="upload-file"
            type="file"
            accept=".pdf,.docx,.csv,application/pdf,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="submit" disabled={!file || create.isPending}>
          {create.isPending ? 'Creating…' : 'Upload'}
        </Button>
      </form>
    );
  }

  function FaqTab({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');

    function submit(event: React.FormEvent) {
      event.preventDefault();
      create.mutate(
        {
          kind: 'faq',
          name: name || 'FAQ',
          faq: [{ question, answer }],
        },
        {
          onSuccess: () => {
            toast.success('FAQ added to the knowledge base.');
            onDone();
          },
          onError: () => toast.error('Could not create the FAQ.'),
        },
      );
    }

    return (
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="faq-name">Source name</Label>
          <Input
            id="faq-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Common questions"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faq-q">Question</Label>
          <Input
            id="faq-q"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What are your opening hours?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faq-a">Answer</Label>
          <Textarea
            id="faq-a"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="We open at 9am…"
            rows={3}
          />
        </div>
        <Button type="submit" disabled={!question || !answer || create.isPending}>
          {create.isPending ? 'Adding…' : 'Add FAQ'}
        </Button>
      </form>
    );
  }

  function WebsiteTab({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');

    function submit(event: React.FormEvent) {
      event.preventDefault();
      create.mutate(
        { kind: 'website', name: name || url, url },
        {
          onSuccess: () => {
            toast.success('Website queued for ingestion.');
            onDone();
          },
          onError: () => toast.error('Could not enqueue the website.'),
        },
      );
    }

    return (
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="web-name">Name</Label>
          <Input
            id="web-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pricing page"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="web-url">URL</Label>
          <Input
            id="web-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/pricing"
            required
          />
        </div>
        <Button type="submit" disabled={!url || create.isPending}>
          {create.isPending ? 'Queueing…' : 'Ingest website'}
        </Button>
      </form>
    );
  }
}
