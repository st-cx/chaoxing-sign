export default defineNuxtPlugin(() => {
  const library = useLocationsStore()
  const { data } = useAuth()
  watch(() => (data.value as { uid?: string } | null)?.uid, uid => library.activate(uid), { immediate: true })
})
