"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";
import { buildLocalizedMarketingPath } from "@/lib/i18n/public-locale";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" } as const,
  transition: { duration: 0.45 },
};

export default function AboutPage() {
  const { t, isRTL, locale } = useTranslation("marketing.about");

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="mx-auto max-w-2xl px-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            {t("label")}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]"
          >
            {t("headline")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg sm:leading-relaxed"
          >
            {t("intro")}
          </motion.p>
        </div>
      </section>

      {/* PULL QUOTE — the core insight */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-6">
          <motion.blockquote
            {...fade}
            className="border-s-2 border-slate-900 ps-6"
          >
            <p className="text-xl font-semibold leading-relaxed tracking-tight text-slate-900 sm:text-2xl sm:leading-relaxed">
              {t("pullquote")}
            </p>
          </motion.blockquote>
        </div>
      </section>

      {/* THESIS */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("thesis.label")}
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("thesis.headline")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-[17px] sm:leading-relaxed">
              {t("thesis.p1")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* TWO SIDES — what we enable */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("platform.label")}
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("platform.headline")}
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("platform.brands.title")}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {t("platform.brands.desc")}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("platform.creators.title")}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {t("platform.creators.desc")}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STANDARDS — invite-only */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("standards.label")}
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("standards.headline")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-[17px] sm:leading-relaxed">
              {t("standards.p1")}
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-[17px] sm:leading-relaxed">
              {t("standards.p2")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* BEYOND — connections */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("beyond.label")}
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("beyond.headline")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-[17px] sm:leading-relaxed">
              {t("beyond.p1")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ORIGIN — who we are */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("origin.label")}
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("origin.headline")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-[17px] sm:leading-relaxed">
              {t("origin.p1")}
            </p>
            <p className="mt-6 text-xs leading-relaxed text-slate-400">
              {t("origin.entity")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* CLOSING — typographic moment */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <motion.div {...fade}>
            <p className="text-[2rem] font-extrabold leading-[1.2] tracking-tight text-slate-900 sm:text-[2.5rem]">
              {t("closing")}
            </p>
            <p className="mx-auto mt-6 max-w-sm text-base leading-relaxed text-slate-500">
              {t("closing.sub")}
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href={buildLocalizedMarketingPath(locale, "/request-invite")}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {t("cta.primary")}
                <ArrowRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
              <a
                href="mailto:hello@popsdrops.com"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                {t("cta.contact")}
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
