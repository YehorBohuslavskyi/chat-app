export const demoCredentials = {
  email: 'alex@loop.demo',
  password: 'LoopDemo123!'
}

export function createFixtures() {
  const users = [
    {
      id: 'alex',
      firstName: 'Alex',
      lastName: 'Morgan',
      nickName: 'alex',
      email: demoCredentials.email,
      color: '#7061c7',
      status: 'online'
    },
    {
      id: 'mia',
      firstName: 'Mia',
      lastName: 'Chen',
      nickName: 'mia',
      email: 'mia@loop.demo',
      color: '#c27751',
      status: 'online'
    },
    {
      id: 'noah',
      firstName: 'Noah',
      lastName: 'Williams',
      nickName: 'noah',
      email: 'noah@loop.demo',
      color: '#538881',
      status: 'online'
    },
    {
      id: 'sofia',
      firstName: 'Sofia',
      lastName: 'Rivera',
      nickName: 'sofia',
      email: 'sofia@loop.demo',
      color: '#ad668c',
      status: 'dnd'
    },
    {
      id: 'james',
      firstName: 'James',
      lastName: 'Park',
      nickName: 'james',
      email: 'james@loop.demo',
      color: '#748399',
      status: 'offline'
    }
  ]
  const channels = [
    {
      id: 'general',
      name: 'general',
      description:
        'The place for team updates, good questions, and little wins.',
      type: 'public',
      adminId: 'mia',
      memberIds: users.map(u => u.id),
      invitedIds: []
    },
    {
      id: 'design',
      name: 'design-studio',
      description: 'Work in progress. Fresh perspectives. Thoughtful feedback.',
      type: 'public',
      adminId: 'alex',
      memberIds: ['alex', 'mia', 'sofia'],
      invitedIds: []
    },
    {
      id: 'engineering',
      name: 'engineering',
      description: 'Building things that bring people together.',
      type: 'public',
      adminId: 'noah',
      memberIds: ['alex', 'noah', 'james'],
      invitedIds: []
    },
    {
      id: 'random',
      name: 'off-topic',
      description: 'A little room for everything outside of work.',
      type: 'public',
      adminId: 'sofia',
      memberIds: users.map(u => u.id),
      invitedIds: []
    },
    {
      id: 'launch',
      name: 'launch-room',
      description: 'A shared space to get our next release over the line.',
      type: 'private',
      adminId: 'mia',
      memberIds: ['mia', 'alex', 'noah'],
      invitedIds: ['alex']
    },
    {
      id: 'feedback',
      name: 'feedback',
      description:
        'Ideas and feedback from across the team. Everyone is welcome.',
      type: 'public',
      adminId: 'james',
      memberIds: ['james', 'mia'],
      invitedIds: []
    }
  ]
  const conversation = [
    [
      'mia',
      'Morning, team! ☀️ A fresh week and a few exciting things in the works. How is everyone doing?'
    ],
    [
      'noah',
      'Morning! The channel navigation is feeling really good. I’ve been testing the smaller screens today.'
    ],
    [
      'sofia',
      'Just shared the latest design explorations in #design-studio. Would love a second pair of eyes when you have a moment.'
    ],
    ['alex', 'On it! Really like how the workspace is coming together.'],
    [
      'mia',
      '@alex could you take a look at the welcome flow? A new teammate should feel at home from the first click.'
    ],
    [
      'alex',
      'Absolutely. Keeping it simple: find your channel, meet the team, start a conversation.'
    ],
    [
      'james',
      'Small win: the first version of the project notes is ready. All the decisions now have a home. 🎉'
    ],
    ['noah', 'Love that. Fewer scattered notes, more time to build.'],
    [
      'sofia',
      'Also, a reminder to share the rough drafts. It doesn’t have to be finished to be worth discussing.'
    ],
    [
      'mia',
      'This is exactly what this space is for. Let’s make something good together. ✨'
    ]
  ]
  let sequence = 0
  const messages = []
  for (const channel of channels) {
    const count =
      channel.id === 'general' ? 50 : channel.id === 'launch' ? 0 : 8
    for (let i = 0; i < count; i++) {
      const pair = conversation[i % conversation.length]
      const senderId = channel.memberIds.includes(pair[0])
        ? pair[0]
        : channel.adminId
      messages.push({
        id: ++sequence,
        channelId: channel.id,
        senderId,
        body: pair[1],
        createdAt: new Date(Date.now() - (count - i) * 240000).toISOString()
      })
    }
  }
  return { users, channels, messages, sequence, credentials: {} }
}
