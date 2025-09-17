import React, { forwardRef } from "react";
import { PositionalAudio } from "@react-three/drei";
import type { PositionalAudio as ThreePositionalAudio } from "three";
import { WALL_AUDIO_URL, WALL_AUDIO_DISTANCE } from "../constant.ts";

type PlayerAudioProps = {
url?: string;
distance?: number;
};

export const PlayerAudio = forwardRef<ThreePositionalAudio, PlayerAudioProps>(
function PlayerAudio({ url = WALL_AUDIO_URL, distance = WALL_AUDIO_DISTANCE }, ref) {
return (
<PositionalAudio
ref={ref as any}
url={url}
distance={distance}
loop={false}
autoplay={false}
/>
);
}
);