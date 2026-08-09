import UnknownPullsBackdrop from "@/components/player/UnknownPullsBackdrop";
import UnownText from "@/components/player/UnownText";

export default function AuthLoading({
  title = "Opening the gateway",
}: {
  title?: string;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#040617] px-4 text-white">
      <UnknownPullsBackdrop />

      <div className="relative z-10 text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <div className="absolute inset-2 animate-spin rounded-full border border-transparent border-r-cyan-100/30 border-t-yellow-100/60 [animation-duration:2.8s]" />
          <img
            src="/ancient-pulls/celestial-cat.png"
            alt=""
            className="h-16 w-16 animate-pulse object-contain opacity-90"
          />
        </div>

        <div className="mt-5">
          <UnownText
            text={title}
            translation={title}
            size="1.15rem"
            tone="holo"
            centred
          />
        </div>
      </div>
    </main>
  );
}
