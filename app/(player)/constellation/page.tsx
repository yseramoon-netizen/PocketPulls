import { redirect } from 'next/navigation';
import { observatoryHref, type ObservatorySearch } from '@/lib/player/observatoryNavigation';

export default async function LegacyConstellationPage({searchParams}:{searchParams:Promise<ObservatorySearch>}){
  redirect(observatoryHref(await searchParams));
}
