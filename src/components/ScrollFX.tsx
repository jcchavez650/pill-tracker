"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Adds the immersive motion layer:
 *  - scroll-reveal of cards and [data-reveal] elements as they enter the viewport
 *  - a gentle pointer-driven 3D tilt on cards (fine-pointer devices only)
 *  - a --sy scroll variable for parallax
 * Fully disabled when the user prefers reduced motion.
 */
export function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("reveal-on");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.add("reduce-motion");
      return;
    }

    // Reveal-on-scroll
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    let scheduled = false;
    function scan() {
      scheduled = false;
      const nodes = document.querySelectorAll<HTMLElement>(
        ".card:not([data-fx]), [data-reveal]:not([data-fx])"
      );
      let i = 0;
      nodes.forEach((el) => {
        el.setAttribute("data-fx", "1");
        el.style.setProperty("--reveal-delay", `${Math.min(i, 6) * 45}ms`);
        i++;
        io.observe(el);
      });
    }
    function scheduleScan() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(scan);
    }
    scan();

    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });

    // Parallax scroll variable
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        root.style.setProperty("--sy", String(window.scrollY));
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Pointer tilt (desktop-ish devices only)
    const fine = window.matchMedia("(pointer: fine)").matches;
    let activeCard: HTMLElement | null = null;

    function onMove(ev: PointerEvent) {
      const card = (ev.target as HTMLElement)?.closest?.(".card") as
        | HTMLElement
        | null;
      if (card !== activeCard) {
        if (activeCard) {
          activeCard.style.removeProperty("--rx");
          activeCard.style.removeProperty("--ry");
        }
        activeCard = card;
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width - 0.5;
      const py = (ev.clientY - r.top) / r.height - 0.5;
      const max = 4; // degrees — subtle
      card.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
    }
    function clearTilt() {
      if (activeCard) {
        activeCard.style.removeProperty("--rx");
        activeCard.style.removeProperty("--ry");
        activeCard = null;
      }
    }
    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", clearTilt);
    }

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (fine) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerleave", clearTilt);
      }
    };
    // Re-scan when the route changes (new page's cards).
  }, [pathname]);

  return null;
}
