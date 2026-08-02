"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


export default function LoginPage() {


  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");





  async function login() {


    const { error } = await supabase.auth.signInWithPassword({

      email,

      password

    });



    if(error){

      alert(error.message);

      return;

    }



    router.push("/admin");


  }





  return (

    <main className="min-h-screen bg-black text-white flex items-center justify-center">


      <div className="bg-gray-900 p-8 rounded-lg w-96">


        <h1 className="text-3xl font-bold text-center mb-6">

          PocketPulls Login

        </h1>



        <input

          className="w-full p-3 text-white rounded mb-3"

          placeholder="Email"

          value={email}

          onChange={(e)=>setEmail(e.target.value)}

        />



        <input

          className="w-full p-3 text-white rounded mb-4"

          placeholder="Password"

          type="password"

          value={password}

          onChange={(e)=>setPassword(e.target.value)}

        />



        <button

          onClick={login}

          className="w-full bg-blue-600 py-3 rounded"

        >

          Login

        </button>



      </div>


    </main>

  );

}