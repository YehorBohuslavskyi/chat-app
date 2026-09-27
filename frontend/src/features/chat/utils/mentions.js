export function messageParts(body, members = []) {
  const known = new Set(members.map(user => user.nickName.toLowerCase()))
  return body
    .split(/((?<![\w@])@[a-zA-Z0-9_-]+)/g)
    .filter(Boolean)
    .map(text => ({
      text,
      mention: text.startsWith('@') && known.has(text.slice(1).toLowerCase())
    }))
}

export function isAddressed(body, user, members) {
  return messageParts(body, members).some(
    part =>
      part.mention &&
      part.text.slice(1).toLowerCase() === user?.nickName.toLowerCase()
  )
}
