"use client";


interface PullHistoryProps {


items:{

id:string;

name:string;

rarity:string;

value:number;

amount_paid?:number;

created_at:string;

image_url?:string;

}[];


}






export default function PullHistory({

items

}:PullHistoryProps){





function timeAgo(date:string){


const seconds =

Math.floor(

(Date.now() -

new Date(date).getTime())

/1000

);




if(seconds < 60)

return `${seconds}s ago`;



const minutes =

Math.floor(seconds/60);



if(minutes < 60)

return `${minutes}m ago`;



const hours =

Math.floor(minutes/60);



if(hours < 24)

return `${hours}h ago`;



return new Date(date)

.toLocaleDateString();


}








function rarityGlow(rarity:string){


const r =

rarity.toLowerCase();





if(r.includes("secret"))

return "shadow-[0_0_40px_rgba(250,204,21,.8)]";



if(r.includes("ultra"))

return "shadow-[0_0_40px_rgba(168,85,247,.8)]";



if(r.includes("rare"))

return "shadow-[0_0_30px_rgba(59,130,246,.6)]";



return "shadow-[0_0_20px_rgba(16,185,129,.5)]";


}








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

shadow-[0_0_70px_rgba(16,185,129,.2)]

"

>



<div

className="

flex

justify-between

items-center

"

>


<div>


<h2

className="

text-3xl

font-black

"

>

🌎 Recent Discoveries

</h2>



<p

className="

text-emerald-200

font-bold

mt-1

"

>

The PocketPulls Forest

</p>


</div>



<span

className="

rounded-full

bg-emerald-400/20

px-5

py-2

font-black

"

>

LIVE

</span>



</div>









<div

className="

mt-8

space-y-4

"

>





{

items.length === 0

?

<div

className="

text-center

py-12

text-emerald-200

font-bold

"

>

No discoveries yet 🌱

</div>



:



items.slice(0,5).map(item=>{



const paid =

Number(item.amount_paid || 0);



const value =

Number(item.value || 0);



const gain =

value-paid;






return(


<div

key={item.id}

className={`

flex

items-center

gap-5

rounded-[2rem]

bg-black/30

border

border-white/10

p-4

transition

hover:bg-white/10

${

rarityGlow(item.rarity)

}

`

}

>




<div

className="

w-20

h-28

rounded-2xl

overflow-hidden

bg-emerald-900

flex

items-center

justify-center

"

>


{

item.image_url

?

<img

src={item.image_url}

className="

w-full

h-full

object-cover

"

/>

:

<span>

🎴

</span>

}



</div>









<div

className="

flex-1

"

>


<h3

className="

font-black

text-xl

"

>

{item.name}

</h3>





<p

className="

text-emerald-200

font-bold

"

>

{item.rarity}

</p>




<p

className="

text-xs

text-gray-300

mt-2

"

>

{timeAgo(item.created_at)}

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

"

>

Paid £{paid.toFixed(2)}

</p>





<p

className="

text-emerald-300

font-black

text-xl

"

>

£{value.toFixed(2)}

</p>





<p

className={`

font-black

text-sm

${

gain>=0

?

"text-yellow-300"

:

"text-red-300"

}

`

}

>

{

gain>=0

?

`+£${gain.toFixed(2)}`

:

`-£${Math.abs(gain).toFixed(2)}`

}


</p>




</div>







</div>


)


})


}




</div>






</section>


);


}