import { redirect } from 'next/navigation'
import { DESK_SPORTS } from '@/lib/desk'

// The Desk always opens on a sport. Once DESK_SPORTS holds more than one this
// becomes a chooser; for now it hands straight off to the only board there is.
export default function DeskIndex() {
  redirect(`/desk/${DESK_SPORTS[0]}`)
}
