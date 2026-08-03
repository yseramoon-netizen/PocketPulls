"use client";


interface PullHistoryProps {

  items:{
    id:string;
    name:string;
    rarity:string;
    value:number;
    created_at:string;
    image_url?:string;
  }[];

}



export default function PullHistory({

  items

}:PullHistoryProps){



return(

<section

className="
mt-12

rounded-[3rem]

bg-white/10

backdrop-blur-2xl

border

border-white/20

p-8

shadow-[0_0_50px_rgba(16,185,129,.15)]

"

>


<div

className="
flex
justify-between
items-center
"

>


<h2

className="
text-3xl
font-black
"

>

Recent Discoveries

</h2>


<p

className="
text-emerald-200
font-bold
"

>

Global Forest

</p>


</div>







<div

className="
mt-6
space-y-4
"

>


{

items.length === 0

?

<div

className="
text-center
py-10
text-emerald-200
font-bold
"

>

No discoveries yet 🌱

</div>


:


items.map((item)=>(


<div

key={item.id}

className="

flex

items-center

gap-5

rounded-3xl

bg-black/20

border

border-white/10

p-4

hover:bg-white/10

transition

"

>


<div

className="
w-16
h-16
rounded-2xl
bg-gradient-to-br
from-emerald-400
to-green-700
flex
items-center
justify-center
text-3xl
"

>

🎴

</div>






<div

className="
flex-1
"

>


<h3

className="
font-black
text-lg
"

>

{item.name}

</h3>



<p

className="
text-emerald-200
text-sm
font-bold
"

>

{item.rarity}

</p>


</div>





<div

className="
text-right
"

>


<p

className="
font-black
text-xl
"

>

£{item.value.toFixed(2)}

</p>


<p

className="
text-xs
text-gray-300
"

>

{

new Date(
item.created_at
).toLocaleDateString()

}

</p>


</div>





</div>


))

}



</div>



</section>


);


}