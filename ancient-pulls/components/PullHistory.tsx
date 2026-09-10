"use client";


type Props = {
items:any[];
};



export default function PullHistory({
items
}:Props){



if(!items || items.length===0){

return (

<div className="
text-center
py-10
text-emerald-200
font-bold
">

🌱 No discoveries yet...

</div>

);

}





return (

<div className="space-y-4">


{

items.map((item)=>{


return (

<div

key={item.id}

className="

flex

items-center

gap-5

rounded-3xl

bg-white/10

border

border-white/20

backdrop-blur-xl

p-4

"

>



<img

src={item.image_url}

className="

w-20

h-28

rounded-xl

object-cover

shadow-lg

"

/>






<div className="flex-1">


<h3 className="

text-xl

font-black

text-white

">

🎴 {item.name}

</h3>




<p className="

text-emerald-200

font-bold

">

{item.rarity}

</p>





<p className="

text-sm

text-emerald-100/70

">

Paid:

£{Number(item.amount_paid).toFixed(2)}

</p>




<p className="

text-yellow-300

font-black

">

Value:

£{Number(item.value).toFixed(2)}

</p>




</div>



</div>


);


})


}


</div>

);


}