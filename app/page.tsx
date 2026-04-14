import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="flex flex-col items-center justify-center w-full px-6"
      style={{ minHeight: "100dvh", background: "#171515" }}
    >
      <div className="flex flex-col gap-8 w-full max-w-sm py-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-3xl font-bold tracking-tight flex items-start gap-1.5">
            ask ember
            <svg width={22} height={22} viewBox="0 0 72 72" fill="white" className="mt-0.5 flex-shrink-0">
              <circle cx="36" cy="36" r="7.2" fill="#f97316"/>
              <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
              <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6"/>
              <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)"/>
              <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)"/>
              <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)"/>
              <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)"/>
              <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)"/>
              <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)"/>
            </svg>
          </h1>
          <p className="text-white/60 leading-relaxed text-base">
            An AI-guided companion that helps you preserve memories through shared, thoughtful conversations with friends and family.
          </p>
          <h2 className="text-white font-semibold text-base">Voices Matter</h2>
          <p className="text-white/60 leading-relaxed text-base">
            Ember records real voices of the people who gather to reflect on a moment—capturing what happened, how it felt, and what it meant to everyone.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-white font-semibold text-base">The Story Circle</h2>
            <p className="text-white/60 leading-relaxed text-base">
              Invite others to join a group conversation about a time or place—preserving not just the stories, but the voices and reactions around them.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-white font-semibold text-base">Keep It Alive</h2>
            <p className="text-white/60 leading-relaxed text-base">
              Ember connects every story into a living archive. Evolving as new memories, voices, and perspectives are added over time.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/signup"
            className="flex items-center justify-center w-full h-12 rounded-full text-white text-sm font-semibold tracking-wide transition-opacity hover:opacity-80"
            style={{ background: "#f97316" }}
          >
            Sign Up
          </Link>
          <Link
            href="/signin"
            className="py-3 px-6 text-white/50 text-sm font-medium hover:text-white/80 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
