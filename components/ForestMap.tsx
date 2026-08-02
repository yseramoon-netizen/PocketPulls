"use client";

type Props = {
  cards:number;
  locations:number;
};



export default function ForestMap({

cards,

locations

}:Props){



function getBiome(){


if(cards < 1000){

return {

name:"Seedling Clearing",

tree:"🌱",

sky:"from-[#fef9c3] to-[#dcfce7]"

};

}



if(cards < 5000){

return {

name:"Whispering Woods",

tree:"🌿",

sky:"from-[#dcfce7] to-[#bbf7d0]"

};

}




if(cards < 10000){

return {

name:"Ancient Grove",

tree:"🌳",

sky:"from-[#bbf7d0] to-[#a7f3d0]"

};

}





return {

name:"Enchanted Forest",

tree:"✨🌲✨",

sky:"from-[#ddd6fe] to-[#bbf7d0]"

};


}




const biome = getBiome();






return (

<section className={`

mt-10

rounded-[3rem]

overflow-hidden

bg-gradient-to-br

${biome.sky}

border

border-green-100

shadow-xl

p-6

md:p-8

`}>



<div className="text-center">


<p className="

uppercase

tracking-widest

text-xs

text-green-700

">

Forest Map

</p>



<h2 className="

text-3xl

font-bold

text-green-900

mt-2

">

{biome.name}

</h2>



</div>









<div className="

relative

mt-8

h-80

rounded-[2.5rem]

bg-white/40

overflow-hidden

border

border-white/60

">







{/* clouds */}



<div className="

absolute

top-8

left-10

text-4xl

opacity-50

">

☁️

</div>



<div className="

absolute

top-14

right-14

text-4xl

opacity-50

">

☁️

</div>









{/* side trees */}



<div className="

absolute

bottom-8

left-8

text-6xl

">

🌲

</div>



<div className="

absolute

bottom-8

right-8

text-6xl

">

🌲

</div>









{/* central tree */}



<div className="

absolute

bottom-6

left-1/2

-translate-x-1/2

text-8xl

transition

">

{biome.tree}

</div>









{/* forest roots */}



<div className="

absolute

bottom-5

left-5

bg-white/80

backdrop-blur

rounded-2xl

px-5

py-3

shadow

">


📦 {locations}

{" "}

roots


</div>









{/* collection energy */}



<div className="

absolute

top-5

left-1/2

-translate-x-1/2

bg-white/80

backdrop-blur

rounded-full

px-6

py-2

shadow

text-green-800

font-semibold

">


✨ {cards.toLocaleString()} cards


</div>









{/* little decorations */}


{

cards > 1000 &&

<div className="

absolute

bottom-20

left-1/4

text-3xl

">

🌸

</div>

}



{

cards > 5000 &&

<div className="

absolute

top-32

right-1/4

text-3xl

">

🦋

</div>

}



{

cards > 10000 &&

<div className="

absolute

top-24

left-1/4

text-3xl

">

✨

</div>

}





</div>








</section>


);


}