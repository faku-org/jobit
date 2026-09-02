import {
  CalendarClock,
  Check,
  Clock3,
  GraduationCap,
  Hourglass,
  Laptop,
  ListFilter,
  Sparkles,
  Star,
  Tag as TagIcon,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useDismissable } from "../hooks/useDismissable.ts";
import {
  JOB_TYPE_LABEL,
  LEVEL_LABEL,
  WORK_MODE_LABEL,
  closesIn,
  formatSalary,
  relativeDate,
} from "../lib/format.ts";
import { type Profile, meetsEducation } from "../lib/profile.ts";
import { fadeUpTransition } from "../lib/motion.ts";
import { chipClass, menuItemClass, mutedChip, popoverClass } from "../lib/styles.ts";
import { type Job, type Preferences, type Tag, isPreferredTag, workMode } from "../lib/types.ts";

/** What the chips of a card know, and what they can do to the list around them. */
export interface TagActions {
  preferences: Preferences;
  /** Only read to tell whether the offer asks for more than the person studied. */
  profile: Profile;
  onFilter: (tag: Tag) => void;
  onTogglePreferred: (tag: Tag) => void;
}

interface JobChipsProps {
  job: Job;
  actions: TagActions;
}

interface TagChipProps {
  tag: Tag;
  actions: TagActions;
  icon?: typeof Clock3;
  /** Colours for this chip, minus the interactive states. */
  tone?: string;
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
}: {
  icon: typeof Star;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={menuItemClass} role="menuitem" type="button" onClick={onClick}>
      <Icon aria-hidden className="size-3.5 shrink-0 text-brand" />
      {children}
    </button>
  );
}

/**
 * A chip that opens a small menu: narrow the list to offers carrying this tag,
 * or star it so every offer with it gets pulled forward.
 */
function TagChip({ tag, actions, icon: Icon, tone = mutedChip }: TagChipProps) {
  const [open, setOpen] = useState(false);
  const container = useDismissable<HTMLSpanElement>(open, () => setOpen(false));
  const preferred = isPreferredTag(tag, actions.preferences);

  return (
    <span ref={container} className="relative inline-flex">
      <motion.button
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${tone} transition-colors hover:text-ink ${
          preferred ? "ring-1 ring-brand" : ""
        } ${open ? "ring-1 ring-brand" : ""}`}
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((current) => !current)}
      >
        {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
        {tag.label.charAt(0).toUpperCase() + tag.label.slice(1)}
        {preferred ? <Star aria-hidden className="size-3 fill-current text-brand" /> : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`${popoverClass} top-full left-0 mt-1 w-52`}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            role="menu"
            transition={fadeUpTransition}
          >
            <MenuItem
              icon={ListFilter}
              onClick={() => {
                actions.onFilter(tag);
                setOpen(false);
              }}
            >
              Ver ofertas así
            </MenuItem>
            <MenuItem
              icon={Star}
              onClick={() => {
                actions.onTogglePreferred(tag);
                setOpen(false);
              }}
            >
              {preferred ? "Quitar de prioridades" : "Priorizar este tag"}
            </MenuItem>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** The one-line facts of an offer, shared by the card and the modal. The ones
 * that match a filter are clickable; the rest are plain text. */
export function JobChips({ job, actions }: JobChipsProps) {
  const salary = formatSalary(job.salary);
  const mode = workMode(job);
  const closing = closesIn(job.closes_at);
  const meets = meetsEducation(job, actions.profile);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={mutedChip}>
        <Clock3 aria-hidden className="size-3.5" />
        {relativeDate(job.date_posted).charAt(0).toUpperCase() +
          relativeDate(job.date_posted).slice(1)}
      </span>

      <TagChip
        actions={actions}
        icon={TagIcon}
        tag={{ dimension: "category", value: job.category, label: job.category_label }}
      />

      {job.no_experience ? (
        <TagChip
          actions={actions}
          icon={Sparkles}
          tag={{ dimension: "noExperience", value: "", label: "Sin experiencia" }}
          tone={`${chipClass} bg-sky/40 text-ink`}
        />
      ) : null}

      {job.job_type ? (
        <TagChip
          actions={actions}
          tag={{
            dimension: "jobType",
            value: job.job_type,
            label: JOB_TYPE_LABEL[job.job_type],
          }}
        />
      ) : null}

      <TagChip
        actions={actions}
        icon={Laptop}
        tag={{ dimension: "mode", value: mode, label: WORK_MODE_LABEL[mode] }}
        tone={job.remote ? `${chipClass} bg-brand/15 text-ink` : mutedChip}
      />

      {job.level ? (
        <TagChip
          actions={actions}
          tag={{ dimension: "level", value: job.level, label: LEVEL_LABEL[job.level] }}
        />
      ) : null}

      {salary ? (
        <span className={`${chipClass} bg-ink/10 text-ink`}>
          <Wallet aria-hidden className="size-3.5" />
          {salary}
        </span>
      ) : null}

      {job.education_level ? (
        <span
          className={
            meets === null
              ? mutedChip
              : meets
                ? `${chipClass} bg-brand/15 text-ink`
                : `${chipClass} bg-ink/10 text-ink/60`
          }
          title={
            meets === null
              ? undefined
              : meets
                ? "Cumplís con el nivel educativo pedido"
                : "Pide más nivel educativo del que cargaste en tu perfil"
          }
        >
          <GraduationCap aria-hidden className="size-3.5" />
          {job.education_level}
          {meets ? <Check aria-hidden className="size-3" /> : null}
        </span>
      ) : null}

      {closing ? (
        <span
          className={
            closing === "cerrada" || closing === "cierra hoy" || closing === "cierra mañana"
              ? `${chipClass} bg-ink/10 text-ink`
              : mutedChip
          }
        >
          <Hourglass aria-hidden className="size-3.5" />
          {closing}
        </span>
      ) : null}

      {job.schedule ? (
        <span className={mutedChip}>
          <CalendarClock aria-hidden className="size-3.5" />
          {job.schedule}
        </span>
      ) : null}
    </div>
  );
}
