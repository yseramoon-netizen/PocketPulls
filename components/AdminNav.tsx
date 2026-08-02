"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";


export default function AdminNav() {

  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState("");


  useEffect(() => {

    getUser();

  }, []);




  async function getUser() {


    const {
      data: { user },
      error: userError

    } = await supabase.auth.getUser();



    console.log("AUTH USER:", user);



    if (userError || !user) {

      router.push("/login");

      return;

    }




    const {
      data: profile,
      error: profileError

    } = await supabase

      .from("profiles")

      .select("name")

      .eq("id", user.id)
      .maybeSingle();





    console.log("PROFILE:", profile);

    console.log("PROFILE ERROR:", profileError);





    if (profile?.name) {

      setName(profile.name);

    } else {

      setName("NO PROFILE FOUND");

    }


  }





  async function logout(){

    await supabase.auth.signOut();

    router.push("/login");

  }





  const links = [

    {
      name:"Inventory Logger",
      href:"/admin"
    },

    {
      name:"Inventory",
      href:"/admin/inventory"
    }

  ];





  return (

    <nav className="w-full bg-gray-900 border-b border-gray-700 p-4 mb-8">


      <div className="flex justify-between items-center">


        <div className="flex gap-4">


          {links.map((link)=>(


            <Link

              key={link.href}

              href={link.href}

              className={`px-4 py-2 rounded ${
                
                pathname === link.href

                ? "bg-blue-600"

                : "bg-gray-800"

              }`}

            >

              {link.name}

            </Link>


          ))}


        </div>




        <div className="flex items-center gap-4">


          <span className="font-bold">

            Welcome, {name}

          </span>



          <button

            onClick={logout}

            className="bg-red-600 px-4 py-2 rounded"

          >

            Logout

          </button>


        </div>


      </div>


    </nav>

  );

}