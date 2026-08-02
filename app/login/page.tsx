"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {

  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");



  async function login(){

    setLoading(true);
    setError("");

    const {
      error
    } = await supabase.auth.signInWithPassword({

      email,

      password

    });



    if(error){

      setError(error.message);
      setLoading(false);
      return;

    }



    router.push("/admin");

  }






  return (

    <main className="
    min-h-screen
    bg-gray-50
    flex
    items-center
    justify-center
    p-6
    ">


      <div className="
      bg-white
      rounded-3xl
      shadow-xl
      border
      border-gray-200
      p-10
      w-full
      max-w-md
      text-center
      ">



        <img

        src="/shaymin.png"

        className="
        w-32
        h-32
        mx-auto
        object-contain
        mb-5
        "

        />



        <h1 className="
        text-4xl
        font-bold
        text-emerald-700
        ">

        PocketPulls 🌿

        </h1>




        <p className="
        mt-3
        text-gray-500
        ">

        Welcome back, Trainer

        </p>






        <div className="
        mt-8
        space-y-4
        ">



          <input

          className="
          w-full
          p-4
          rounded-2xl
          border
          border-gray-200
          outline-none
          focus:border-emerald-500
          "

          placeholder="Email"

          type="email"

          value={email}

          onChange={(e)=>
            setEmail(e.target.value)
          }

          />





          <input

          className="
          w-full
          p-4
          rounded-2xl
          border
          border-gray-200
          outline-none
          focus:border-emerald-500
          "

          placeholder="Password"

          type="password"

          value={password}

          onChange={(e)=>
            setPassword(e.target.value)
          }

          />




        </div>








        {error && (

          <p className="
          mt-4
          text-red-500
          text-sm
          ">

          {error}

          </p>

        )}






        <button

        onClick={login}

        disabled={loading}

        className="
        mt-8
        w-full
        bg-emerald-600
        hover:bg-emerald-700
        text-white
        font-bold
        py-4
        rounded-2xl
        transition
        "

        >

        {
          loading
          ?
          "Entering Forest..."
          :
          "Enter PocketPulls 🌿"
        }


        </button>





        <p className="
        mt-8
        text-xs
        text-gray-400
        ">

        Lets Make Money

        </p>



      </div>


    </main>

  );

}