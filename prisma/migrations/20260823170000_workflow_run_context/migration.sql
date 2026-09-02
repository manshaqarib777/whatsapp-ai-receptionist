-- Milestone 13 repair: persist run variables so delayed execution resumes deterministically.
ALTER TABLE "workflow_runs" ADD COLUMN "context" JSONB NOT NULL DEFAULT '{}';
