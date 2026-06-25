export default function LandingPage() {
  return (
    <main className="landing-hero">
      <div className="hero-bg-circle-1" />
      <div className="hero-bg-circle-2" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/main_logo_audiodocs_dark.svg"
        alt="Audiodocs"
        className="landing-logo"
      />
    </main>
  );
}
