"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import ForestBackground from "@/components/ForestBackground";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          router.replace("/admin");
          router.refresh();
          return;
        }
      } catch (sessionError) {
        console.error(
          "Session check error:",
          sessionError,
        );
      } finally {
        setCheckingSession(false);
      }
    }

    void checkSession();
  }, [router]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      if (!data.user) {
        throw new Error(
          "ancientpulls could not verify your account.",
        );
      }

      router.replace("/admin");
      router.refresh();
    } catch (loginError: unknown) {
      console.error(
        "Login error:",
        loginError,
      );

      setError(
        loginError instanceof Error
          ? loginError.message
          : "Login failed. Check your details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main
        className="
          relative
          flex
          min-h-screen
          items-center
          justify-center
          overflow-hidden
          bg-gradient-to-br
          from-[#020617]
          via-[#052e16]
          to-[#064e3b]
          px-4
          text-white
        "
      >
        <ForestBackground />

        <div
          className="
            relative
            z-10
            flex
            flex-col
            items-center
            justify-center
          "
        >
          <div
            className="
              flex
              h-20
              w-20
              animate-pulse
              items-center
              justify-center
              rounded-[1.75rem]
              border
              border-emerald-200/20
              bg-emerald-300/10
              text-4xl
              shadow-[0_0_50px_rgba(52,211,153,0.2)]
              backdrop-blur-3xl
            "
          >
            🌿
          </div>

          <p
            className="
              mt-5
              font-black
              text-emerald-100
            "
          >
            Awakening ancientpulls...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-gradient-to-br
        from-[#020617]
        via-[#052e16]
        to-[#064e3b]
        px-4
        py-6
        text-white
        md:px-8
        md:py-8
      "
    >
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            -left-52
            top-0
            h-[42rem]
            w-[42rem]
            rounded-full
            bg-emerald-400/10
            blur-[150px]
          "
        />

        <div
          className="
            absolute
            -right-56
            top-24
            h-[44rem]
            w-[44rem]
            rounded-full
            bg-cyan-300/10
            blur-[170px]
          "
        />

        <div
          className="
            absolute
            bottom-[-18rem]
            left-1/3
            h-[40rem]
            w-[40rem]
            rounded-full
            bg-lime-300/[0.06]
            blur-[150px]
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.2)_55%,rgba(2,6,23,0.75)_100%)]
          "
        />
      </div>

      <div
        className="
          relative
          z-10
          mx-auto
          flex
          min-h-[calc(100vh-3rem)]
          max-w-[1500px]
          items-center
          justify-center
        "
      >
        <section
          className="
            grid
            w-full
            max-w-6xl
            overflow-hidden
            rounded-[2.75rem]
            border
            border-white/15
            bg-white/[0.07]
            shadow-[0_45px_150px_rgba(0,0,0,0.5)]
            backdrop-blur-3xl
            lg:grid-cols-[1.15fr_0.85fr]
          "
        >
          <div
            className="
              relative
              hidden
              min-h-[44rem]
              overflow-hidden
              border-r
              border-white/10
              p-12
              lg:flex
              lg:flex-col
              lg:justify-between
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-gradient-to-br
                from-emerald-300/15
                via-transparent
                to-cyan-300/[0.05]
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                -bottom-20
                -right-20
                h-96
                w-96
                rounded-full
                bg-emerald-300/10
                blur-[100px]
              "
            />

            <div className="relative z-10">
              <div
                className="
                  inline-flex
                  items-center
                  gap-3
                  rounded-full
                  border
                  border-emerald-200/20
                  bg-emerald-400/10
                  px-4
                  py-2
                  text-sm
                  font-black
                  text-emerald-100
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                    bg-emerald-300
                    shadow-[0_0_16px_rgba(110,231,183,1)]
                  "
                />

                ancientpulls Operations
              </div>

              <h1
                className="
                  mt-8
                  max-w-xl
                  text-6xl
                  font-black
                  leading-[0.98]
                  tracking-[-0.055em]
                "
              >
                Enter the
                <span className="text-emerald-300">
                  {" "}
                  Forest Control Room
                </span>
              </h1>

              <p
                className="
                  mt-6
                  max-w-lg
                  text-lg
                  font-medium
                  leading-8
                  text-emerald-50/65
                "
              >
                Manage the Pokémon card database,
                physical inventory, customer pulls and
                ancientpulls operations from one secure
                workspace.
              </p>
            </div>

            <div className="relative z-10">
              <div
                className="
                  grid
                  grid-cols-3
                  gap-3
                "
              >
                <div
                  className="
                    rounded-[1.5rem]
                    border
                    border-white/10
                    bg-black/15
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-emerald-300/10
                      text-xl
                    "
                  >
                    🎴
                  </div>

                  <p
                    className="
                      mt-4
                      text-sm
                      font-black
                    "
                  >
                    Card Database
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-white/40
                    "
                  >
                    Search and manage records
                  </p>
                </div>

                <div
                  className="
                    rounded-[1.5rem]
                    border
                    border-white/10
                    bg-black/15
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-cyan-300/10
                      text-xl
                    "
                  >
                    📦
                  </div>

                  <p
                    className="
                      mt-4
                      text-sm
                      font-black
                    "
                  >
                    Inventory
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-white/40
                    "
                  >
                    Control physical stock
                  </p>
                </div>

                <div
                  className="
                    rounded-[1.5rem]
                    border
                    border-white/10
                    bg-black/15
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-violet-300/10
                      text-xl
                    "
                  >
                    ✨
                  </div>

                  <p
                    className="
                      mt-4
                      text-sm
                      font-black
                    "
                  >
                    Pull System
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-white/40
                    "
                  >
                    Monitor every discovery
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-6
                  flex
                  items-center
                  justify-between
                  rounded-[1.5rem]
                  border
                  border-emerald-200/15
                  bg-emerald-300/[0.07]
                  px-5
                  py-4
                "
              >
                <div className="flex items-center gap-3">
                  <span
                    className="
                      h-2.5
                      w-2.5
                      rounded-full
                      bg-emerald-300
                      shadow-[0_0_14px_rgba(110,231,183,1)]
                    "
                  />

                  <div>
                    <p
                      className="
                        text-sm
                        font-black
                        text-emerald-100
                      "
                    >
                      System operational
                    </p>

                    <p
                      className="
                        text-xs
                        font-medium
                        text-emerald-50/40
                      "
                    >
                      Secure Supabase authentication
                    </p>
                  </div>
                </div>

                <span
                  className="
                    rounded-full
                    border
                    border-emerald-200/15
                    bg-black/15
                    px-3
                    py-1.5
                    text-xs
                    font-black
                    text-emerald-100/70
                  "
                >
                  ADMIN
                </span>
              </div>
            </div>
          </div>

          <div
            className="
              relative
              flex
              min-h-[42rem]
              items-center
              justify-center
              p-5
              sm:p-8
              md:p-12
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-gradient-to-b
                from-white/[0.035]
                to-transparent
              "
            />

            <div
              className="
                relative
                z-10
                w-full
                max-w-md
              "
            >
              <div className="text-center">
                <div
                  className="
                    mx-auto
                    flex
                    h-28
                    w-28
                    items-center
                    justify-center
                    rounded-[2.25rem]
                    border
                    border-emerald-200/20
                    bg-gradient-to-br
                    from-emerald-300/15
                    to-emerald-950/20
                    shadow-[0_0_60px_rgba(52,211,153,0.18)]
                    backdrop-blur-3xl
                  "
                >
                  <img
                    src="/ancient-pulls/celestial-cat.png"
                    alt="ancientpulls"
                    className="
                      h-24
                      w-24
                      object-contain
                      drop-shadow-2xl
                    "
                  />
                </div>

                <div
                  className="
                    mt-6
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-white/10
                    bg-white/[0.05]
                    px-3
                    py-1.5
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.16em]
                    text-white/45
                    lg:hidden
                  "
                >
                  ancientpulls Operations
                </div>

                <h2
                  className="
                    mt-5
                    text-4xl
                    font-black
                    tracking-[-0.045em]
                  "
                >
                  Welcome back
                </h2>

                <p
                  className="
                    mt-3
                    font-medium
                    leading-6
                    text-white/45
                  "
                >
                  Sign in to access the ancientpulls admin
                  workspace.
                </p>
              </div>

              <form
                onSubmit={handleLogin}
                className="mt-9"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="
                      text-sm
                      font-black
                      text-white
                    "
                  >
                    Email address
                  </label>

                  <div className="relative mt-3">
                    <span
                      className="
                        pointer-events-none
                        absolute
                        left-4
                        top-1/2
                        -translate-y-1/2
                        text-lg
                        text-emerald-100/45
                      "
                      aria-hidden="true"
                    >
                      ✉
                    </span>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);

                        if (error) {
                          setError("");
                        }
                      }}
                      autoComplete="email"
                      placeholder="admin@pocketpulls.com"
                      disabled={submitting}
                      className="
                        min-h-16
                        w-full
                        rounded-2xl
                        border
                        border-white/15
                        bg-black/20
                        py-4
                        pl-12
                        pr-5
                        font-bold
                        text-white
                        outline-none
                        transition
                        placeholder:text-white/25
                        focus:border-emerald-300/50
                        focus:bg-black/30
                        focus:shadow-[0_0_35px_rgba(52,211,153,0.12)]
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="password"
                    className="
                      text-sm
                      font-black
                      text-white
                    "
                  >
                    Password
                  </label>

                  <div className="relative mt-3">
                    <span
                      className="
                        pointer-events-none
                        absolute
                        left-4
                        top-1/2
                        -translate-y-1/2
                        text-lg
                        text-emerald-100/45
                      "
                      aria-hidden="true"
                    >
                      ◆
                    </span>

                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value,
                        );

                        if (error) {
                          setError("");
                        }
                      }}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      disabled={submitting}
                      className="
                        min-h-16
                        w-full
                        rounded-2xl
                        border
                        border-white/15
                        bg-black/20
                        py-4
                        pl-12
                        pr-16
                        font-bold
                        text-white
                        outline-none
                        transition
                        placeholder:text-white/25
                        focus:border-emerald-300/50
                        focus:bg-black/30
                        focus:shadow-[0_0_35px_rgba(52,211,153,0.12)]
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) => !current,
                        )
                      }
                      disabled={submitting}
                      className="
                        absolute
                        right-3
                        top-1/2
                        flex
                        h-10
                        min-w-11
                        -translate-y-1/2
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-white/10
                        bg-white/[0.06]
                        px-3
                        text-xs
                        font-black
                        text-white/55
                        transition
                        hover:bg-white/10
                        hover:text-white
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    className="
                      mt-6
                      rounded-[1.5rem]
                      border
                      border-red-300/20
                      bg-red-500/10
                      px-5
                      py-4
                      text-sm
                      font-bold
                      leading-6
                      text-red-100
                      shadow-[0_0_30px_rgba(239,68,68,0.08)]
                    "
                  >
                    <div className="flex gap-3">
                      <span
                        className="
                          flex
                          h-7
                          w-7
                          flex-none
                          items-center
                          justify-center
                          rounded-lg
                          bg-red-400/15
                          text-red-200
                        "
                      >
                        !
                      </span>

                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    mt-7
                    flex
                    min-h-16
                    w-full
                    items-center
                    justify-center
                    gap-3
                    rounded-2xl
                    border
                    border-emerald-100/30
                    bg-emerald-300
                    px-6
                    text-lg
                    font-black
                    text-emerald-950
                    shadow-[0_0_45px_rgba(110,231,183,0.25)]
                    transition
                    hover:-translate-y-0.5
                    hover:bg-emerald-200
                    hover:shadow-[0_0_55px_rgba(110,231,183,0.35)]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    disabled:hover:translate-y-0
                  "
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin">
                        ◌
                      </span>

                      Entering the forest...
                    </>
                  ) : (
                    <>
                      Sign in to ancientpulls
                      <span aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div
                className="
                  mt-7
                  rounded-[1.5rem]
                  border
                  border-white/10
                  bg-white/[0.035]
                  px-5
                  py-4
                "
              >
                <div className="flex items-start gap-3">
                  <span
                    className="
                      flex
                      h-8
                      w-8
                      flex-none
                      items-center
                      justify-center
                      rounded-xl
                      bg-emerald-300/10
                      text-sm
                    "
                  >
                    🔒
                  </span>

                  <div>
                    <p
                      className="
                        text-sm
                        font-black
                        text-white/75
                      "
                    >
                      Restricted admin access
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        font-medium
                        leading-5
                        text-white/35
                      "
                    >
                      This workspace controls live stock,
                      balances and customer pull records.
                    </p>
                  </div>
                </div>
              </div>

              <p
                className="
                  mt-7
                  text-center
                  text-xs
                  font-semibold
                  text-white/25
                "
              >
                ancientpulls internal operations system
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}