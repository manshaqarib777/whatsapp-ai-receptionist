'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DURATION,
  EASE,
  fadeUp,
  scaleIn,
  staggerContainer,
  staggerItem,
} from '@/lib/motion';
import { Row, Section } from '@/features/design-system/components/section';

/**
 * Animation specimens.
 *
 * Two things are being reviewed here, not one: that the motion is tasteful, and that
 * it disappears entirely under `prefers-reduced-motion`. The global CSS reset in
 * `globals.css` collapses CSS transitions, but Motion animates inline styles in
 * JavaScript and ignores that reset — so components must ask, which is what
 * `useReducedMotion` does below.
 */
export function MotionSection() {
  const [replayKey, setReplayKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  return (
    <Section
      id="motion"
      title="Animations"
      description="Entrances only, 100–320ms, on a single easing curve. Nothing loops, nothing bounces."
    >
      <Row>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReplayKey((key) => key + 1)}
        >
          Replay
        </Button>
        {/* Reported through CSS variants rather than from `useReducedMotion()`. The
            server cannot know the visitor's preference, so branching the TEXT on it
            renders one thing on the server and another on the client — a hydration
            mismatch that makes React discard and rebuild this part of the page. The
            animations themselves still branch in JavaScript; only the label cannot. */}
        <p className="text-muted-foreground text-xs">
          <span className="motion-reduce:hidden">Reduced motion is off.</span>
          <span className="hidden motion-reduce:inline">
            Reduced motion is on: entrances resolve instantly.
          </span>
        </p>
      </Row>

      <div key={replayKey} className="grid gap-4 sm:grid-cols-3">
        <motion.div {...(prefersReducedMotion ? {} : fadeUp)}>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">fadeUp</p>
              <p className="text-muted-foreground text-xs">
                Cards, panels, anything entering in place.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...(prefersReducedMotion ? {} : scaleIn)}>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">scaleIn</p>
              <p className="text-muted-foreground text-xs">
                Overlays — a 2% scale, never a pop.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.ul
          initial="initial"
          animate="animate"
          variants={prefersReducedMotion ? undefined : staggerContainer}
          className="space-y-2"
        >
          {['Acme Dental', 'Globex Clinic', 'Initech Health'].map((name) => (
            <motion.li
              key={name}
              variants={prefersReducedMotion ? undefined : staggerItem}
              className="bg-card rounded-lg border px-3 py-2 text-sm"
            >
              {name}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <Row label="Hover and press — 100ms, and the surface moves 1px, not 8">
        <motion.button
          type="button"
          whileHover={prefersReducedMotion ? undefined : { y: -1 }}
          whileTap={prefersReducedMotion ? undefined : { y: 0 }}
          transition={{ duration: DURATION.instant, ease: EASE }}
          className="bg-card focus-visible:ring-ring rounded-xl border px-4 py-3 text-sm shadow-xs transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
        >
          Interactive card
        </motion.button>
      </Row>
    </Section>
  );
}
