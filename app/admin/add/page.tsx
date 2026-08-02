"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

export default function AddPage() {

  const [search,setSearch] = useState("");
  const [cards,setCards] = useState<any[]>([]);
  const [selectedCard,setSelectedCard] = useState<any>(null);

  const [quantity,setQuantity] = useState(1);
  const [location,setLocation] = useState("");

  const [user,setUser] = useState<any>(null);

  const [message,setMessage] = useState("");





  useEffect(()=>{

    loadUser();

  },[]);





  async function loadUser(){

    const {
      data:{
        user
      }
    } = await supabase.auth.getUser();


    setUser(user);

  }







  async function searchCards(value:string){


    setSearch(value);


    if(!value.trim()){

      setCards([]);

      return;

    }



    const {

      data,
      error

    } = await supabase

      .from("pokemon_cards")

      .select("*")

      .ilike(

        "name",

        `%${value}%`

      )

      .limit(20);




    if(error){

      console.log(error);

      return;

    }


    setCards(data || []);


  }









  async function addToInventory(){


    if(!selectedCard)
      return alert(
        "Choose a Pokémon first 🌿"
      );



    if(!user)
      return alert(
        "Login required"
      );






    const {

      data:existing

    } = await supabase

      .from("inventory")

      .select(
        "id,quantity"
      )

      .eq(
        "card_id",
        selectedCard.id
      )

      .maybeSingle();








    if(existing){



      await supabase

      .from("inventory")

      .update({

        quantity:

          Number(existing.quantity)

          +

          Number(quantity)

      })

      .eq(

        "id",

        existing.id

      );




    }

    else {



      await supabase

      .from("inventory")

      .insert({

        card_id:
          selectedCard.id,

        quantity,

        status:
          "in_stock",

        location:
          location || "Forest Storage",

        added_by:
          user.email,

        added_by_user_id:
          user.id

      });


    }






    setMessage(

      `${selectedCard.name} joined the forest 🌿`

    );


    setSelectedCard(null);

    setQuantity(1);

    setLocation("");

  }









return (

<main className="
min-h-screen
bg-gradient-to-br
from-emerald-50
via-white
to-green-100
p-4
md:p-8
text-gray-900
">


<div className="
max-w-7xl
mx-auto
">


<AdminNav />







<section className="
text-center
mb-10
">


<img

src="/shaymin.png"

className="
w-28
mx-auto
"

/>



<h1 className="
text-4xl
font-bold
text-emerald-700
mt-4
">

Add a visitor 🌱

</h1>



<p className="
text-gray-500
mt-2
">

Add cards into the PocketPulls forest

</p>


</section>









<input

className="
w-full
p-4
rounded-full
shadow
border
mb-8
"

placeholder="
🔍 Search Pokémon...
"

value={search}

onChange={(e)=>
searchCards(e.target.value)
}

/>









<div className="
grid
grid-cols-2
sm:grid-cols-3
md:grid-cols-5
gap-5
">


{cards.map(card=>(


<div

key={card.id}

onClick={()=>
setSelectedCard(card)
}

className="
cursor-pointer
bg-white
rounded-3xl
shadow
p-3
hover:scale-105
transition
"


>


<img

src={card.image_url}

className="
rounded-2xl
"

/>


<p className="
font-bold
mt-2
">

{card.name}

</p>


<p className="
text-xs
text-gray-500
">

{card.set_name}

</p>


</div>


))}



</div>









{selectedCard && (


<div className="
fixed
bottom-28
left-1/2
-translate-x-1/2
w-[90%]
max-w-lg
bg-white
rounded-3xl
shadow-2xl
border
p-6
z-50
">


<h2 className="
text-2xl
font-bold
text-emerald-700
">

{selectedCard.name}

</h2>





<div className="
flex
justify-center
items-center
gap-5
my-5
">


<button

className="
bg-red-200
w-12
h-12
rounded-full
"

onClick={()=>
setQuantity(
Math.max(1,quantity-1)
)
}

>

-

</button>



<span className="
text-3xl
font-bold
">

{quantity}

</span>



<button

className="
bg-green-200
w-12
h-12
rounded-full
"

onClick={()=>
setQuantity(quantity+1)
}

>

+

</button>


</div>






<input

className="
w-full
p-3
border
rounded-xl
"

placeholder="Storage location"

value={location}

onChange={(e)=>
setLocation(e.target.value)
}

/>







<button

onClick={addToInventory}

className="
mt-4
w-full
bg-emerald-600
text-white
rounded-xl
py-3
font-bold
"

>

🌿 Add to Forest

</button>



</div>


)}







{message && (

<p className="
fixed
top-24
left-1/2
-translate-x-1/2
bg-emerald-600
text-white
px-6
py-3
rounded-full
shadow
">

✨ {message}

</p>

)}




</div>

</main>

);


}