"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

interface PresentationSnapshotCycleProps {
  nextHref: string;
  nextLabel: string;
}

const CYCLE_SECONDS = 30;

export function PresentationSnapshotCycle({
  nextHref,
  nextLabel,
}: PresentationSnapshotCycleProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(CYCLE_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          router.push(nextHref);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [nextHref, router]);

  const elapsedPercent =
    ((CYCLE_SECONDS - secondsLeft) / CYCLE_SECONDS) * 100;

  return (
    <div className="presentation-cycle" role="status" aria-live="polite">
      <div>
        <strong>30초 발표 전환</strong>
        <span>
          {secondsLeft}초 뒤 {nextLabel} 화면으로 이동합니다.
        </span>
      </div>
      <div
        className="presentation-cycle-track"
        aria-hidden="true"
        style={{ "--cycle-progress": `${elapsedPercent}%` } as CSSProperties}
      >
        <span />
      </div>
      <Link href={nextHref}>지금 {nextLabel} 보기</Link>
    </div>
  );
}
