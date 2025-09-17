import { JSX, memo, useMemo, cloneElement } from "react";
import { useItemsStore } from "@/levels/state/itemsStore";
import { Coin, Cone, Gelato, IceStick, Bear, Flag, ItemsProps, Strawberry, IceCream, CupCake,
    Cake, CheeseCake, Bread, Drink, Drink2, Granita
 } from "@/levels/assets/Items";

type Props = {
    coord: string;
    type: string;
    position?: [number, number, number];
};

const registry: Record<string, (p: ItemsProps) => JSX.Element> = {
    "coin": (p) => <Coin {...p} />,
    "ice-stick": (p) => <IceStick {...p} />,
    "gelato": (p) => <Gelato {...p} />,
    "cone": (p) => <Cone {...p} />,
    "bear": (p) => <Bear {...p} />,
    "flag": (p) => <Flag {...p} />,
    "strawberry": (p) => <Strawberry {...p} />,
    "ice-cream": (p) => <IceCream {...p} />,
    "cupcake": (p) => <CupCake {...p} />,
    "cake": (p) => <Cake {...p} />,
    "cheesecake": (p) => <CheeseCake {...p} />,
    "bread": (p) => <Bread {...p} />,
    "drink": (p) => <Drink {...p} />,
    "drink2": (p) => <Drink2 {...p} />,
    "granita": (p) => <Granita {...p} />,


};

export const ItemAtCoord = memo(function ItemAtCoord({ coord, type, position = [0, 0, 0] }: Props) {
    // Se non c’è un renderer per questo tipo, non renderizzare nulla
    const render = registry[type];
    if (!render) return null;

    const key = coord.toUpperCase();
    // Subscribe puntuale allo stato di raccolta per questa cella
    const collected = useItemsStore((s) => s.items[key]?.collected ?? false);

    // Forziamo il remount quando cambia lo stato di raccolta, così l’ExplodableSprite
    // si resetta tra un livello e l’altro (o a reset).
    const renderKey = useMemo(() => `${ key } - ${ collected? "col": "free" }`, [key, collected]);

    // L’esplosione si triggera quando collected passa a true
    const element = render({
        position,
        explode: collected,
    });
    return cloneElement(element, { key: renderKey });
});