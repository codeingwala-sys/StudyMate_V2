import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── STUDY BUDDIES ─────────────────────────────────────────────────────────────
export function useLiveBuddies(user, isActive, durationMins, onEmoji, roomId = 'lobby') {
  const [buddies, setBuddies] = useState([])
  const channelRef = useRef(null)
  // FIX 1: Store onEmoji in a ref so broadcast listeners never go stale
  const onEmojiRef = useRef(onEmoji)
  useEffect(() => { onEmojiRef.current = onEmoji }, [onEmoji])
  // FIX 2: Stable anon key — computed once, not on every render
  const anonKey = useRef(`anon-${Date.now()}`)
  const myKey = user?.id || anonKey.current

  useEffect(() => {
    if (!supabase) return

    const channel = supabase.channel(`study-buddies-${roomId}`, {
      config: { presence: { key: myKey } }
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const parsed = []
        for (const [key, presenceData] of Object.entries(state)) {
          // FIX 3: Don't include self in the buddies list
          if (key === myKey) continue
          const info = presenceData[0]
          if (info && info.status === 'focusing') {
            parsed.push({
              _id: key,
              userId: key,
              userName: info.userName,
              duration: info.duration,
              status: info.status
            })
          }
        }
        setBuddies(parsed)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isActive && user) {
          await channel.track({
            userName: user.name || 'Student',
            duration: durationMins,
            status: 'focusing'
          })
        }
      })

    // Use ref so this listener always calls the latest onEmoji prop
    channel.on('broadcast', { event: 'emoji' }, ({ payload }) => {
      if (onEmojiRef.current) onEmojiRef.current(payload)
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [myKey, roomId]) // eslint-disable-line

  // Updates presence without reconnecting
  useEffect(() => {
    if (channelRef.current?.state === 'joined' && user) {
      if (isActive) {
        channelRef.current.track({
          userName: user.name || 'Student',
          duration: durationMins,
          status: 'focusing'
        }).catch(() => {})
      } else {
        channelRef.current.untrack().catch(() => {})
      }
    }
  }, [isActive, durationMins, user])

  const sendEmoji = (emoji) => {
    if (channelRef.current?.state === 'joined') {
      channelRef.current.send({ type: 'broadcast', event: 'emoji', payload: { emoji, from: user?.name } }).catch(() => {})
      if (onEmojiRef.current) onEmojiRef.current({ emoji, from: user?.name, isSelf: true })
    }
  }

  return { buddies, sendEmoji }
}

// ── RECALL BATTLES ────────────────────────────────────────────────────────────
export function useLiveBattles() {
  const [battles, setBattles] = useState([])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('battles-lobby')
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const list = []
      for (const [key, data] of Object.entries(state)) {
        if (data[0] && data[0].isHost) {
          list.push({
            _id: data[0].battleId,
            topic: data[0].topic,
            hostName: data[0].hostName,
            status: data[0].status || 'waiting',
            players: []
          })
        }
      }
      setBattles(list)
    }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return battles
}

export function useBattleRoom(battleId, user, isHost, initialTopic, initialQuestions) {
  const [battle, setBattle] = useState({
     _id: battleId,
     topic: initialTopic || '',
     questions: initialQuestions || [],
     status: 'waiting', // waiting, active, finished
     players: isHost ? [{ id: user?.id || `anon-${Date.now()}`, name: user?.name || 'Host', score: 0 }] : [],
     currentQuestion: 0,
     hostName: user?.name || 'Host'
  })
  
  const lobbyRef = useRef(null)
  const roomRef = useRef(null)
  const myId = useRef(user?.id || `anon-${Date.now()}`)
  
  // HOST: Manage Lobby advertisement
  useEffect(() => {
    if (!isHost || !supabase) return
    const lobby = supabase.channel('battles-lobby', {
      config: { presence: { key: battleId } }
    })
    lobby.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && battle.status === 'waiting') {
        await lobby.track({ isHost: true, battleId, topic: battle.topic, hostName: battle.hostName })
      } else if (status === 'SUBSCRIBED' && battle.status !== 'waiting') {
        lobby.untrack().catch(()=>{})
      }
    })
    lobbyRef.current = lobby
    
    return () => { supabase.removeChannel(lobby) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, battleId, battle.status, battle.topic, battle.hostName])

  // ALL: Room Sync via Broadcast
  useEffect(() => {
    if (!supabase) return
    const room = supabase.channel(`battle-${battleId}`)
    roomRef.current = room
    
    room.on('broadcast', { event: 'state_update' }, ({ payload }) => {
      // Host sends full state to clients
      if (!isHost) setBattle(payload)
    })
    
    room.on('broadcast', { event: 'player_join' }, ({ payload }) => {
      if (isHost) {
        setBattle(prev => {
          if (prev.players.find(p => p.id === payload.id)) return prev
          const next = { ...prev, players: [...prev.players, payload] }
          room.send({ type: 'broadcast', event: 'state_update', payload: next }).catch(()=>{})
          return next
        })
      }
    })
    
    room.on('broadcast', { event: 'score_update' }, ({ payload }) => {
      if (isHost) {
        setBattle(prev => {
          const nextPlayers = prev.players.map(p => p.id === payload.id ? { ...p, score: p.score + payload.points } : p)
          const next = { ...prev, players: nextPlayers }
          room.send({ type: 'broadcast', event: 'state_update', payload: next }).catch(()=>{})
          return next
        })
      }
    })

    room.subscribe((status) => {
       if (status === 'SUBSCRIBED') {
         if (!isHost) {
           // Guest tells Host they joined
           room.send({ 
             type: 'broadcast', 
             event: 'player_join', 
             payload: { id: myId.current, name: user?.name || 'Explorer', score: 0 } 
           }).catch(()=>{})
         } else {
           // Host pushes initial state immediately in case guests connected first
           room.send({ 
             type: 'broadcast', 
             event: 'state_update', 
             payload: battle 
           }).catch(()=>{})
         }
       }
    })
    
    return () => { supabase.removeChannel(room) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId, isHost, user?.name])

  // Actions
  const startBattle = () => {
    if (!isHost) return
    setBattle(prev => {
      const next = { ...prev, status: 'active', startTime: Date.now() }
      roomRef.current?.send({ type: 'broadcast', event: 'state_update', payload: next })
      return next
    })
  }

  const nextQuestion = () => {
    if (!isHost) return
    setBattle(prev => {
      const nextIdx = (prev.currentQuestion || 0) + 1;
      const isFinished = nextIdx >= (prev.questions?.length || 0);
      const next = { ...prev, currentQuestion: nextIdx, status: isFinished ? 'finished' : 'active' }
      roomRef.current?.send({ type: 'broadcast', event: 'state_update', payload: next })
      return next
    })
  }

  const updateScore = (points) => {
    if (isHost) {
      setBattle(prev => {
        const nextPlayers = prev.players.map(p => p.id === myId.current ? { ...p, score: p.score + points } : p)
        const next = { ...prev, players: nextPlayers }
        roomRef.current?.send({ type: 'broadcast', event: 'state_update', payload: next })
        return next
      })
    } else {
      roomRef.current?.send({ type: 'broadcast', event: 'score_update', payload: { id: myId.current, points } })
    }
  }
  
  return { battle, startBattle, updateScore, nextQuestion }
}
