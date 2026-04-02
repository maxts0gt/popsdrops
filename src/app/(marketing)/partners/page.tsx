"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function PartnersPage() {
  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            We connect brands with local partners.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-lg text-base text-slate-500"
          >
            Our creator network spans 20+ markets. We use that knowledge to broker partnerships between brands and local distributors.
          </motion.p>
        </div>
      </section>

      {/* HOW IT WORKS — minimal */}
      <section className="pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 px-6"
        >
          {["Market research", "Partner vetting", "Introduction", "Deal support"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </motion.div>
      </section>

      {/* TWO PATHS */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Brand side */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">For Brands</p>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                Enter a new market.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                You have the product. We find you the right local distributor, retailer, or agency — vetted, with existing market presence.
              </p>
              <div className="mt-6 space-y-2 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>We research the market and identify potential partners</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>We vet and introduce the right fit</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>We support the deal through closing</span>
                </div>
              </div>
              <a
                href="mailto:partners@popsdrops.com?subject=Brand%20partnership%20inquiry"
                className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Get in touch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            {/* Partner side */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">For Distributors</p>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                Access global brands.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                You have the local presence. We connect you with international brands looking to enter your market.
              </p>
              <div className="mt-6 space-y-2 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>Brands across beauty, fashion, F&amp;B, tech, and more</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>Vetted brands with real market-entry intent</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>No upfront fees — commission-based</span>
                </div>
              </div>
              <a
                href="mailto:partners@popsdrops.com?subject=Distributor%20partnership%20inquiry"
                className="group mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Join as a partner
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* COMMISSION — transparent */}
      <section className="py-12">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">How we work</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            No retainers. No upfront fees. We earn a commission on successful partnerships — 10% of first-year sales. That&apos;s it. If the deal doesn&apos;t close, you pay nothing.
          </p>
        </div>
      </section>
    </div>
  );
}
