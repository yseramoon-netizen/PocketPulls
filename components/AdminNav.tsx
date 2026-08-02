"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminNav() {

  const router = useRouter();

  const [name,setName] = useState("Trainer");


  useEffect(()=>{

    loadProfile();

  },[]);



  async function loadProfile(){

    const {
      data:{
        user
      }
    } = await supabase.auth.getUser();


    if(!user) return;


    const {
      data:profile
    } = await supabase

      .from("profiles")
      .select("name")
      .eq("id",user.id)
      .maybeSingle();


    setName(
      profile?.name || "Trainer"
    );

  }





  async function logout(){

    await supabase.auth.signOut();

    router.push("/login");

  }





  return (

    <nav className="
    bg-white
    shadow-lg
    rounded-3xl
    border
    border-gray-200
    p-4
    mb-6
    ">


      <div className="
      flex
      flex-col
      gap-4
      md:flex-row
      md:items-center
      md:justify-between
      ">



        <div className="
        flex
        justify-between
        items-center
        ">


        <Link

        href="/admin"

        className="
        text-xl
        md:text-2xl
        font-bold
        text-emerald-700
        "

        >

        🌿 PocketPulls

        </Link>


        <img

        src="/shaymin.png"

        className="
        w-10
        h-10
        md:hidden
        "

        />

        </div>






        <div className="
        text-center
        md:text-left
        ">

        <p className="
        text-xs
        text-gray-500
        ">

        Welcome back

        </p>


        <p className="
        font-bold
        text-emerald-700
        ">

        {name} 🌿

        </p>


        </div>







        <div className="
        flex
        justify-center
        gap-2
        flex-wrap
        ">


        <Link

        href="/admin"

        className="
        px-4
        py-2
        rounded-full
        bg-emerald-50
        text-emerald-700
        text-sm
        "

        >

        Dashboard

        </Link>



        <Link

        href="/admin/inventory"

        className="
        px-4
        py-2
        rounded-full
        bg-emerald-50
        text-emerald-700
        text-sm
        "

        >

        Inventory

        </Link>




        <button

        onClick={logout}

        className="
        px-4
        py-2
        rounded-full
        bg-emerald-600
        text-white
        text-sm
        "

        >

        Logout

        </button>



        </div>


      </div>


    </nav>

  );

}