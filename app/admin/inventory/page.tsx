"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

export default function InventoryPage() {

  const [inventory, setInventory] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [updatingPrices, setUpdatingPrices] = useState(false);



  useEffect(() => {

    loadInventory();

  }, []);





  async function loadInventory() {

    setLoading(true);


    const { data, error } = await supabase

      .from("inventory")

      .select(`

        id,
        quantity,
        location,
        added_by_user_id,

        pokemon_cards(
          id,
          name,
          set_name,
          image_url,
          market_value
        ),

        profiles:added_by_user_id(
          name
        )

      `);



    if(error){

      console.log(error);
      setLoading(false);
      return;

    }



    setInventory(data || []);
    setFiltered(data || []);

    setLoading(false);

  }






  async function refreshPrices(){

    setUpdatingPrices(true);

    await fetch("/api/update-prices");

    await loadInventory();

    setUpdatingPrices(false);

  }







  function searchCards(value:string){

    setSearch(value);


    if(!value.trim()){

      setFiltered(inventory);
      return;

    }


    setFiltered(

      inventory.filter(item =>

        item.pokemon_cards?.name

        ?.toLowerCase()

        .includes(
          value.toLowerCase()
        )

      )

    );

  }







  async function updateQuantity(
    id:string,
    current:number,
    change:number
  ){

    const newQuantity =
      current + change;


    if(newQuantity <= 0){

      deleteCard(id);
      return;

    }


    await supabase

      .from("inventory")

      .update({

        quantity:newQuantity

      })

      .eq(
        "id",
        id
      );


    loadInventory();

  }







  async function deleteCard(id:string){

    if(!confirm("Delete this card?"))
    return;


    await supabase

      .from("inventory")

      .delete()

      .eq(
        "id",
        id
      );


    loadInventory();

  }






  const totalValue = filtered.reduce(

    (total,item)=>

      total +

      (

        Number(
          item.pokemon_cards?.market_value || 0
        )

        *

        Number(
          item.quantity || 0
        )

      ),

    0

  );







  if(loading){

    return (

      <main className="
      min-h-screen
      bg-green-950
      text-white
      flex
      items-center
      justify-center
      text-2xl
      ">

      Loading collection 🌿

      </main>

    );

  }







  return (

    <main className="
    min-h-screen
    bg-gradient-to-br
    from-emerald-950
    via-green-900
    to-lime-950
    text-white
    p-8
    ">


    <AdminNav />



    <div className="
    max-w-7xl
    mx-auto
    ">





    <div className="
    flex
    items-center
    gap-5
    mb-10
    ">


      <img

      src="/shaymin.png"

      className="
      w-24
      h-24
      object-contain
      "

      />


      <div>

      <h1 className="
      text-5xl
      font-bold
      ">

      PocketPulls

      </h1>


      <p className="
      text-green-300
      text-xl
      ">

      Fairy Forest Inventory 🌿

      </p>


      </div>


    </div>








    <div className="
    bg-white/10
    rounded-3xl
    p-6
    mb-8
    text-center
    border
    border-green-300/20
    ">


      <p className="text-green-200">

      Total Collection Value

      </p>


      <h2 className="
      text-5xl
      font-bold
      text-green-300
      ">

      £{totalValue.toFixed(2)}

      </h2>



      <button

      onClick={refreshPrices}

      disabled={updatingPrices}

      className="
      mt-5
      bg-green-300
      text-black
      px-8
      py-3
      rounded-full
      font-bold
      "

      >

      {
        updatingPrices
        ?
        "Updating..."
        :
        "Refresh Prices 💎"
      }


      </button>


    </div>








    <input

    className="
    w-full
    p-4
    rounded-full
    text-black
    mb-10
    "

    placeholder="🔍 Search Pokémon..."

    value={search}

    onChange={(e)=>
      searchCards(e.target.value)
    }

    />








    <div className="
    grid
    grid-cols-2
    md:grid-cols-4
    lg:grid-cols-6
    gap-6
    ">


    {filtered.map(item=>(


      <div

      key={item.id}

      className="
      bg-white/10
      rounded-3xl
      p-4
      border
      border-green-300/20
      hover:-translate-y-2
      transition
      ">


      <img

      src={item.pokemon_cards?.image_url}

      className="
      rounded-2xl
      "

      />



      <h2 className="
      font-bold
      mt-3
      ">

      {item.pokemon_cards?.name}

      </h2>



      <p className="
      text-green-300
      text-sm
      ">

      {item.pokemon_cards?.set_name}

      </p>





      <p className="text-sm mt-3">

      📍 {item.location || "Unknown"}

      </p>



      <p className="text-sm">

      👤 Added by:

      {" "}

      {item.profiles?.name || "Unknown"}

      </p>





      <p className="
      mt-3
      text-green-300
      font-bold
      ">

      💎 £{
        item.pokemon_cards?.market_value || 0
      }

      </p>







      <div className="
      flex
      justify-between
      items-center
      mt-4
      ">


      <button

      onClick={()=>
        updateQuantity(
          item.id,
          item.quantity,
          -1
        )
      }

      className="
      bg-red-400
      text-black
      rounded-full
      w-10
      h-10
      font-bold
      "

      >

      -

      </button>



      <span className="
      text-xl
      font-bold
      ">

      {item.quantity}

      </span>




      <button

      onClick={()=>
        updateQuantity(
          item.id,
          item.quantity,
          1
        )
      }

      className="
      bg-green-300
      text-black
      rounded-full
      w-10
      h-10
      font-bold
      "

      >

      +

      </button>


      </div>





      <button

      onClick={()=>
        deleteCard(item.id)
      }

      className="
      mt-4
      w-full
      bg-red-600
      py-2
      rounded-xl
      font-bold
      "

      >

      Delete

      </button>



      </div>


    ))}


    </div>



    </div>


    </main>

  );

}