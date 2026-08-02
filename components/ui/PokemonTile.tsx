type PokemonTileProps = {
  card: any;
  onClick?: () => void;
  selected?: boolean;
};


export default function PokemonTile({
  card,
  onClick,
  selected = false,
}: PokemonTileProps) {

  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer
        bg-white
        rounded-3xl
        overflow-hidden
        border
        transition-all
        duration-200
        hover:-translate-y-2
        hover:shadow-xl

        ${
          selected
          ? "border-emerald-500 ring-2 ring-emerald-300"
          : "border-emerald-100"
        }
      `}
    >

      <img
        src={card.image_url}
        alt={card.name}
        className="
          w-full
          aspect-square
          object-cover
        "
      />


      <div className="p-4">

        <h3 className="
          font-bold
          text-lg
          text-gray-900
        ">
          {card.name}
        </h3>


        <p className="
          text-sm
          text-gray-500
          mt-1
        ">
          {card.set_name}
        </p>


        <div className="
          flex
          justify-between
          mt-3
          text-sm
        ">

          <span className="
            text-emerald-700
            font-semibold
          ">
            {card.rarity}
          </span>


          {card.market_value && (
            <span>
              £{Number(card.market_value).toFixed(2)}
            </span>
          )}

        </div>

      </div>

    </div>
  );
}