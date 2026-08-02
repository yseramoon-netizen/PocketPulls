"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminNav() {

  const router = useRouter();

  const [name, setName] = useState("Trainer");



  useEffect(() => {

    loadProfile();

  }, []);




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

      .eq(
        "id",
        user.id
      )

      .maybeSingle();



    setName(

      profile?.name
      ||
      "Trainer"

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
    mb-8
    ">


      <div className="
      max-w-7xl
      mx-auto
      flex
      items-center
      justify-between
      gap-6
      ">



        <Link

        href="/admin"

        className="
        text-2xl
        font-bold
        text-emerald-700
        "

        >

        🌿 PocketPulls

        </Link>






        <div className="
        flex
        items-center
        gap-3
        ">


          <img

          src="/shaymin.png"

          className="
          w-12
          h-12
          rounded-full
          object-contain
          "

          />



          <div>

          <p className="
          text-sm
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


        </div>








        <div className="
        flex
        items-center
        gap-3
        ">



          <Link

          href="/admin"

          className="
          px-4
          py-2
          rounded-full
          text-gray-700
          hover:bg-emerald-50
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
          text-gray-700
          hover:bg-emerald-50
          "

          >

          Inventory

          </Link>






          <button

          onClick={logout}

          className="
          px-5
          py-2
          rounded-full
          bg-emerald-600
          text-white
          font-bold
          "

          >

          Logout

          </button>



        </div>




      </div>


    </nav>

  );

}