"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage(){

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");



  const fireflies = [
    {left:10,top:20,delay:1},
    {left:25,top:45,delay:3},
    {left:40,top:15,delay:2},
    {left:55,top:60,delay:4},
    {left:70,top:30,delay:1},
    {left:85,top:70,delay:3},
    {left:15,top:80,delay:2},
    {left:90,top:15,delay:4},
    {left:35,top:75,delay:1},
    {left:65,top:50,delay:3},
    {left:50,top:25,delay:2},
    {left:78,top:85,delay:4}
  ];




  async function login(){

  setLoading(true);
  setError("");

  console.log("Attempting login...");

  const { data, error } = await supabase.auth.signInWithPassword({

    email,

    password

  });


  console.log("Supabase response:", data, error);



  if(error){

    setError(error.message);
    setLoading(false);

    return;

  }



if(data.session){

  console.log("Session created");

  window.location.replace("/admin");

  return;

}



  setError("No session was created");

  setLoading(false);

}





  return (

    <main className="
    relative
    min-h-screen
    overflow-hidden
    flex
    items-center
    justify-center
    bg-gradient-to-br
    from-[#d8f3dc]
    via-[#fff8dc]
    to-[#eadcff]
    p-6
    ">



      <div className="
      absolute
      inset-0
      pointer-events-none
      ">


      {
        fireflies.map((f,i)=>(

          <div

          key={i}

          className="
          absolute
          w-2
          h-2
          rounded-full
          bg-yellow-300
          shadow-[0_0_25px_10px_rgba(253,224,71,.7)]
          animate-pulse
          "

          style={{

            left:`${f.left}%`,
            top:`${f.top}%`,
            animationDelay:`${f.delay}s`

          }}

          />

        ))
      }


      </div>






      <div className="
      relative
      z-10
      w-full
      max-w-md
      ">



        <div className="
        bg-white
        rounded-[3rem]
        shadow-2xl
        border
        border-emerald-200
        p-10
        text-center
        ">




          <img

          src="/shaymin.png"

          className="
          w-36
          h-36
          mx-auto
          object-contain
          drop-shadow-xl
          "

          />





          <h1 className="
          mt-5
          text-5xl
          font-black
          text-emerald-950
          ">

          PocketPulls

          </h1>




          <p className="
          mt-3
          text-lg
          font-semibold
          text-emerald-700
          ">

          Forest Vault Access

          </p>








          <div className="
          mt-8
          space-y-4
          ">



            <input

            type="email"

            placeholder="Email"

            value={email}

            onChange={(e)=>
              setEmail(e.target.value)
            }

            className="
            w-full
            rounded-2xl
            p-4
            bg-gray-50
            border
            border-gray-200
            text-black
            font-semibold
            outline-none
            focus:ring-2
            focus:ring-emerald-400
            "

            />






            <input

            type="password"

            placeholder="Password"

            value={password}

            onChange={(e)=>
              setPassword(e.target.value)
            }

            className="
            w-full
            rounded-2xl
            p-4
            bg-gray-50
            border
            border-gray-200
            text-black
            font-semibold
            outline-none
            focus:ring-2
            focus:ring-emerald-400
            "

            />



          </div>







          {
            error &&

            <div className="
            mt-5
            bg-red-100
            border
            border-red-300
            rounded-2xl
            p-3
            text-red-800
            font-semibold
            text-sm
            ">

            {error}

            </div>

          }







          <button

          onClick={login}

          disabled={loading}

          className="
          mt-8
          w-full
          rounded-2xl
          py-4
          bg-emerald-600
          hover:bg-emerald-700
          text-white
          font-black
          text-lg
          shadow-lg
          transition
          disabled:opacity-50
          "

          >

          {

            loading

            ?

            "Opening Vault..."

            :

            "Enter PocketPulls"

          }


          </button>






          <p className="
          mt-8
          text-sm
          text-gray-500
          font-medium
          ">

          Your Pokémon collection awaits.

          </p>




        </div>


      </div>


    </main>

  );


}