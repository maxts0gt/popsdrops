"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";
import { MARKETING_MOCK_IDENTITIES } from "@/lib/marketing/mock-preview";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" } as const,
  transition: { duration: 0.45 },
};

export default function ForCreatorsPage() {
  const { t, isRTL } = useTranslation("marketing.forCreators");
  const mediaKitIdentity = MARKETING_MOCK_IDENTITIES.yp;

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="whitespace-pre-line text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            {t("headline")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-md text-base text-slate-500"
          >
            {t("subheadline")}
          </motion.p>
        </div>
      </section>

      {/* FEATURES — title-only chips */}
      <section className="pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-6"
        >
          {["value.campaigns", "value.mediaKit", "value.rates", "value.briefs", "value.reputation", "value.counter"].map((key) => (
            <span
              key={key}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {t(key)}
            </span>
          ))}
        </motion.div>
      </section>

      {/* HOW IT WORKS — 4 steps */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div {...fade} className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("how.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("how.title")}</h2>
          </motion.div>

          <div className="mx-auto grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", titleKey: "how.step1.title", descKey: "how.step1.desc" },
              { step: "02", titleKey: "how.step2.title", descKey: "how.step2.desc" },
              { step: "03", titleKey: "how.step3.title", descKey: "how.step3.desc" },
              { step: "04", titleKey: "how.step4.title", descKey: "how.step4.desc" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white p-6 sm:p-7"
              >
                <span className="text-xs font-bold text-slate-300">{item.step}</span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t(item.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MEDIA KIT PREVIEW */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fade} className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("kit.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("kit.title")}</h2>
          </motion.div>

          <div className="mx-auto max-w-lg">
            <motion.div {...fade} className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/[0.03]">
              <div className="p-6 sm:p-8">
                {/* Creator header */}
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500">
                    {mediaKitIdentity.badge}
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">{mediaKitIdentity.label}</p>
                    <p className="text-xs text-slate-400">Seoul, South Korea</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: t("mock.label.campaigns"), value: "24" },
                    { label: t("mock.label.engRate"), value: "9.3%" },
                    { label: t("mock.label.rating"), value: "4.9★" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-lg font-bold text-slate-900">{s.value}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Platforms */}
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("mock.label.platforms")}</p>
                  <div className="mt-2 flex gap-2">
                    {[
                      { name: "Instagram", followers: "142K" },
                      { name: "TikTok", followers: "89K" },
                      { name: "YouTube", followers: "23K" },
                    ].map((p) => (
                      <div key={p.name} className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs">
                        <span className="font-medium text-slate-700">{p.name}</span>
                        <span className="ms-1.5 text-slate-400">{p.followers}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rate card */}
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("mock.label.rateCard")}</p>
                  <div className="mt-2 space-y-1.5">
                    {[
                      { type: "Instagram Reel", rate: "$250" },
                      { type: "TikTok Video", rate: "$200" },
                      { type: "Instagram Story", rate: "$100" },
                      { type: "YouTube Video", rate: "$500" },
                    ].map((r) => (
                      <div key={r.type} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{r.type}</span>
                        <span className="font-semibold text-slate-900">{r.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Niches */}
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {["Beauty", "Skincare", "Lifestyle"].map((n) => (
                    <span key={n} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 px-6 py-3 text-center">
                <p className="text-[10px] text-slate-400">popsdrops.com/c/yuna-park</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-20">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{t("final.title")}</h2>
          <div className="mt-6">
            <a
              href="/login?action=signup&role=creator"
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl"
            >
              {t("cta")}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""}`} />
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t("free")}</p>
        </div>
      </section>
    </div>
  );
}
