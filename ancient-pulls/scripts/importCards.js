require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function getPage(page) {

  for (let attempt = 1; attempt <= 5; attempt++) {

    try {

      const response = await fetch(
        `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=100`,
        {
          headers: {
            "X-Api-Key": process.env.POKEMON_TCG_API_KEY,
          },
        }
      );


      if (!response.ok) {
        console.log(
          `API returned ${response.status}. Attempt ${attempt}/5`
        );

        await sleep(5000);
        continue;
      }


      const data = await response.json();

      return data;


    } catch(error) {

      console.log(
        `Request failed. Attempt ${attempt}/5`
      );

      await sleep(5000);

    }

  }


  console.log(
      `Page ${page} failed. Waiting 30 seconds before retry...`
    );

    await sleep(30000);

    return await getPage(page);

}



async function importCards() {

  let page = 1;
  let total = 0;


  while(true) {

    console.log(
      `Downloading page ${page}...`
    );

    const result = await getPage(page);

    if (!result.data || result.data.length === 0) {
      break;
    }

    const cards = result.data.map(card => ({
      api_id: card.id,
      name: card.name,
      set_name: card.set.name,
      card_no: card.number,
      rarity: card.rarity || "Unknown",
      image_url: card.images.small
    }));

    for (let i = 0; i < cards.length; i += 25) {

      const batch = cards.slice(i, i + 25);

      const { error } = await supabase
        .from("pokemon_cards")
        .upsert(
         batch,
         {
           onConflict: "api_id"
         }
        );


     if (error) {
       console.log(error);
       return;
     }


     console.log(
        `Inserted ${Math.min(i + 25, cards.length)} / ${cards.length}`
      );

     await sleep(1000);
    }

    total += cards.length;

    console.log(
      `${cards.length} saved. Total: ${total}`
    );

    page++;

    await sleep(10000);

  }


  console.log(
    `Finished! Total cards: ${total}`
  );

}


importCards();