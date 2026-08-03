import type { PlayerSeasonStats } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";

type TranslateFn = (key: string) => string;

interface PlayerProfileSeasonStatsCardProps {
    stats: PlayerSeasonStats;
    t: TranslateFn;
}

export default function PlayerProfileSeasonStatsCard({
    stats,
    t,
}: PlayerProfileSeasonStatsCardProps) {
    return (
        <Card>
            <CardHeader>{t("playerProfile.seasonStats")}</CardHeader>
            <CardBody>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                    <StatBox label={t("playerProfile.apps")} value={stats.appearances} />
                    <StatBox label={t("playerProfile.goals")} value={stats.goals} />
                    <StatBox label={t("playerProfile.assists")} value={stats.assists} />
                    <StatBox label={t("playerProfile.mins")} value={stats.minutes_played} />
                    <StatBox
                        label={t("playerProfile.cleanSheets")}
                        value={stats.clean_sheets}
                    />
                    <StatBox
                        label={t("playerProfile.yellows")}
                        value={stats.yellow_cards}
                    />
                    <StatBox label={t("playerProfile.reds")} value={stats.red_cards} />
                    <StatBox
                        label={t("playerProfile.avgRating")}
                        value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "-"}
                    />
                </div>
                {/* Kept apart from the counting stats above: these describe the
                    chances a player had and made rather than what he converted,
                    and reading them beside goals is the point of having them. */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                    <StatBox
                        label={t("playerProfile.xg")}
                        value={stats.xg ? stats.xg.toFixed(1) : "-"}
                    />
                    <StatBox
                        label={t("playerProfile.xa")}
                        value={stats.xa ? stats.xa.toFixed(1) : "-"}
                    />
                    <StatBox
                        label={t("playerProfile.xt")}
                        value={stats.xt ? stats.xt.toFixed(1) : "-"}
                    />
                    <StatBox
                        label={t("playerProfile.distance")}
                        value={
                            stats.distance_km
                                ? `${stats.distance_km.toFixed(0)} km`
                                : "-"
                        }
                    />
                </div>
                <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                    {t("playerProfile.distanceFootnote")}
                </p>
            </CardBody>
        </Card>
    );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="text-center p-2.5 bg-gray-50 dark:bg-navy-700 rounded-lg">
            <p className="font-heading font-bold text-lg text-gray-800 dark:text-gray-100 tabular-nums">
                {value}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-heading uppercase tracking-wider">
                {label}
            </p>
        </div>
    );
}