import { useState, useMemo } from 'react'
import { useGameStore, MAX_DOSES } from '@/store/gameStore'
import { COMMAND_TYPE_INFO, CommandType } from '@/types/game'
import { Swords, ArrowUp, ArrowDown, Trash2, Play, CheckCircle, AlertTriangle, Info } from 'lucide-react'

const DEFAULT_COST: Record<CommandType, number> = {
  move: 1,
  investigate: 1,
  poison: 2,
  useItem: 1,
  defend: 1,
  custom: 1,
}

const PHASE_LABELS: Record<string, string> = {
  action: '行动阶段',
  conflict: '冲突检测',
  settlement: '结算阶段',
  complete: '回合结束',
}

export default function TurnControl() {
  const players = useGameStore((s) => s.players)
  const currentTurn = useGameStore((s) => s.currentTurn)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const commands = useGameStore((s) => s.commands)
  const poisonDefinitions = useGameStore((s) => s.poisonDefinitions)
  const updatePlayerAp = useGameStore((s) => s.updatePlayerAp)
  const submitCommand = useGameStore((s) => s.submitCommand)
  const removeCommand = useGameStore((s) => s.removeCommand)
  const reorderCommand = useGameStore((s) => s.reorderCommand)
  const resolveConflicts = useGameStore((s) => s.resolveConflicts)
  const executeSettlement = useGameStore((s) => s.executeSettlement)
  const completeTurn = useGameStore((s) => s.completeTurn)
  const startNewTurn = useGameStore((s) => s.startNewTurn)

  const alivePlayers = useMemo(() => players.filter((p) => p.isAlive), [players])
  const aliveCount = alivePlayers.length

  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [cmdType, setCmdType] = useState<CommandType>('move')
  const [cost, setCost] = useState(1)
  const [targetId, setTargetId] = useState('')
  const [description, setDescription] = useState('')
  const [poisonType, setPoisonType] = useState(poisonDefinitions[0]?.id ?? '')
  const [doses, setDoses] = useState(1)
  const [errorMessage, setErrorMessage] = useState('')

  const handleTypeChange = (type: CommandType) => {
    setCmdType(type)
    setCost(DEFAULT_COST[type])
    setErrorMessage('')
    if (type !== 'poison') {
      setPoisonType(poisonDefinitions[0]?.id ?? '')
      setDoses(1)
    }
  }

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return players.find((p) => p.id === selectedPlayerId) ?? null
  }, [selectedPlayerId, players])

  const playerCommands = useMemo(() => {
    if (!selectedPlayerId) return []
    return commands.filter((c) => c.playerId === selectedPlayerId)
  }, [selectedPlayerId, commands])

  const remainingAp = useMemo(() => {
    if (!selectedPlayer) return 0
    return selectedPlayer.actionPoints
  }, [selectedPlayer])

  const estimatedPriority = useMemo(() => {
    if (!selectedPlayer) return 0
    return cost * 1000 + selectedPlayer.agility * 10 + commands.length
  }, [selectedPlayer, cost, commands.length])

  const validationError = useMemo(() => {
    if (!selectedPlayer) return ''
    if (selectedPlayer.actionPoints < cost) {
      return `AP不足！需要 ${cost} AP，当前剩余 ${selectedPlayer.actionPoints} AP`
    }
    if (targetId && targetId === selectedPlayerId) {
      return '不能以自己为目标'
    }
    if (cmdType === 'poison' && doses > MAX_DOSES) {
      return `剂量超限！最大剂量为 ${MAX_DOSES}，当前为 ${doses}`
    }
    return ''
  }, [selectedPlayer, cost, targetId, selectedPlayerId, cmdType, doses])

  const handleSubmitCommand = () => {
    setErrorMessage('')
    if (!selectedPlayerId) return
    const player = players.find((p) => p.id === selectedPlayerId)
    if (!player) return
    const target = targetId ? players.find((p) => p.id === targetId) : undefined

    const params: Record<string, unknown> = {}
    if (cmdType === 'poison') {
      params.poisonType = poisonType
      params.doses = doses
    }

    const result = submitCommand({
      playerId: player.id,
      playerName: player.name,
      type: cmdType,
      cost,
      target: targetId || undefined,
      targetName: target?.name,
      params,
      submittedAt: Date.now(),
      description: description || COMMAND_TYPE_INFO[cmdType].label,
    })

    if (!result.success && result.error) {
      setErrorMessage(result.error)
    } else {
      setDescription('')
    }
  }

  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => b.priority - a.priority),
    [commands]
  )

  const conflicts = useMemo(() => {
    const targetMap = new Map<string, string[]>()
    for (const cmd of commands) {
      if (cmd.target) {
        const arr = targetMap.get(cmd.target) || []
        arr.push(cmd.id)
        targetMap.set(cmd.target, arr)
      }
    }
    const conflictIds = new Set<string>()
    for (const [, ids] of targetMap) {
      if (ids.length > 1) {
        ids.forEach((id) => conflictIds.add(id))
      }
    }
    return conflictIds
  }, [commands])

  const resolvedOrder = useMemo(() => resolveConflicts(), [resolveConflicts])

  return (
    <div className="flex flex-col gap-6">
      <div className="card-abyss border-gold-glow rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Swords className="text-gold-500" size={24} />
            <div>
              <h1 className="font-serif text-xl font-bold text-gold-400 text-glow-gold">
                回合控制中心
              </h1>
              <p className="text-bone-400 text-xs mt-0.5">管理行动点 · 提交指令 · 解决冲突</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-bone-500 text-xs">回合</p>
              <p className="text-gold-400 font-serif font-bold tabular-nums">{currentTurn}</p>
            </div>
            <div className="text-center">
              <p className="text-bone-500 text-xs">阶段</p>
              <p className="text-gold-300 font-serif">{PHASE_LABELS[currentPhase] ?? currentPhase}</p>
            </div>
            <div className="text-center">
              <p className="text-bone-500 text-xs">存活</p>
              <p className="text-gold-300 font-serif tabular-nums">{aliveCount}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="card-abyss border-gold-glow rounded-lg p-5">
        <h2 className="font-serif text-lg font-bold text-gold-400 mb-4">⚡ 行动点分配</h2>
        <div className="flex flex-col gap-3">
          {alivePlayers.map((player) => {
            const apPercent = (player.actionPoints / player.maxActionPoints) * 100
            return (
              <div key={player.id} className="flex items-center gap-3 rounded-lg bg-abyss-600/30 border border-gold-500/10 px-4 py-3">
                <span className="text-gold-400 font-serif font-bold text-sm min-w-[80px]">{player.name}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gold-300">AP</span>
                    <span className="text-gold-200 tabular-nums">{player.actionPoints}/{player.maxActionPoints}</span>
                  </div>
                  <div className="h-2 rounded-full bg-abyss-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-700 to-gold-400 transition-all duration-300"
                      style={{ width: `${apPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updatePlayerAp(player.id, -1)}
                    className="btn-gothic px-2 py-1 text-xs"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => updatePlayerAp(player.id, 1)}
                    className="btn-gothic px-2 py-1 text-xs"
                  >
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {alivePlayers.length === 0 && (
            <p className="text-bone-500 text-sm text-center py-4">暂无存活玩家</p>
          )}
        </div>
      </section>

      {currentPhase === 'action' && (
        <section className="card-abyss border-gold-glow rounded-lg p-5">
          <h2 className="font-serif text-lg font-bold text-gold-400 mb-4">📋 提交行动指令</h2>
          <div className="flex flex-col gap-3">
            {selectedPlayer && (
              <div className="rounded-lg bg-abyss-600/30 border border-gold-500/20 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="text-gold-400" size={16} />
                  <span className="text-gold-400 text-xs font-serif">行动预算提示</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-bone-500 text-[10px]">已提交指令</p>
                    <p className="text-gold-300 font-serif font-bold text-sm tabular-nums">{playerCommands.length} 条</p>
                  </div>
                  <div>
                    <p className="text-bone-500 text-[10px]">剩余 AP</p>
                    <p className={`font-serif font-bold text-sm tabular-nums ${remainingAp < cost ? 'text-blood-400' : 'text-gold-300'}`}>
                      {remainingAp} / {selectedPlayer.maxActionPoints}
                    </p>
                  </div>
                  <div>
                    <p className="text-bone-500 text-[10px]">预计优先级</p>
                    <p className="text-gold-300 font-serif font-bold text-sm tabular-nums">{estimatedPriority}</p>
                  </div>
                </div>
              </div>
            )}

            {(validationError || errorMessage) && (
              <div className="rounded-lg bg-blood-900/30 border border-blood-500/30 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="text-blood-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-blood-300 text-sm">{validationError || errorMessage}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-bone-400 text-xs mb-1 block">玩家</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => {
                    setSelectedPlayerId(e.target.value)
                    setErrorMessage('')
                  }}
                  className="input-gothic w-full rounded text-sm"
                >
                  <option value="">选择玩家</option>
                  {alivePlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (AP: {p.actionPoints})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-bone-400 text-xs mb-1 block">指令类型</label>
                <select
                  value={cmdType}
                  onChange={(e) => handleTypeChange(e.target.value as CommandType)}
                  className="input-gothic w-full rounded text-sm"
                >
                  {(Object.keys(COMMAND_TYPE_INFO) as CommandType[]).map((type) => (
                    <option key={type} value={type}>{COMMAND_TYPE_INFO[type].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-bone-400 text-xs mb-1 block">消耗 AP</label>
                <input
                  type="number"
                  min={1}
                  max={selectedPlayer?.maxActionPoints ?? 10}
                  value={cost}
                  onChange={(e) => {
                    setCost(Number(e.target.value))
                    setErrorMessage('')
                  }}
                  className="input-gothic w-full rounded text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="text-bone-400 text-xs mb-1 block">目标玩家 (可选)</label>
                <select
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value)
                    setErrorMessage('')
                  }}
                  className="input-gothic w-full rounded text-sm"
                >
                  <option value="">无</option>
                  {alivePlayers
                    .filter((p) => p.id !== selectedPlayerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
            </div>
            {cmdType === 'poison' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-bone-400 text-xs mb-1 block">毒药类型</label>
                  <select
                    value={poisonType}
                    onChange={(e) => setPoisonType(e.target.value)}
                    className="input-gothic w-full rounded text-sm"
                  >
                    {poisonDefinitions.map((def) => (
                      <option key={def.id} value={def.id}>{def.name} (伤害:{def.damagePerDose}/剂)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-bone-400 text-xs mb-1 block">剂量 (最大 {MAX_DOSES})</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DOSES}
                    value={doses}
                    onChange={(e) => {
                      setDoses(Number(e.target.value))
                      setErrorMessage('')
                    }}
                    className="input-gothic w-full rounded text-sm tabular-nums"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-bone-400 text-xs mb-1 block">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="行动描述..."
                className="input-gothic w-full rounded text-sm"
              />
            </div>
            <button
              onClick={handleSubmitCommand}
              disabled={!selectedPlayerId || !!validationError}
              className="btn-gothic self-end disabled:opacity-40 disabled:cursor-not-allowed"
            >
              提交指令
            </button>
          </div>
        </section>
      )}

      {commands.length > 0 && (
        <section className="card-abyss border-gold-glow rounded-lg p-5">
          <h2 className="font-serif text-lg font-bold text-gold-400 mb-4">🎯 本回合指令队列</h2>
          <div className="flex flex-col gap-2">
            {sortedCommands.map((cmd, index) => {
              const info = COMMAND_TYPE_INFO[cmd.type]
              const isConflict = conflicts.has(cmd.id)
              return (
                <div
                  key={cmd.id}
                  className={`flex items-center gap-3 rounded-lg bg-abyss-600/30 px-4 py-3 border ${
                    isConflict ? 'border-blood-500/40' : 'border-gold-500/10'
                  }`}
                >
                  <span className="text-bone-500 text-xs tabular-nums min-w-[20px]">{index + 1}</span>
                  <span className="text-gold-400 font-serif font-bold text-sm min-w-[70px]">{cmd.playerName}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${info.color}20`,
                      color: info.color,
                      border: `1px solid ${info.color}40`,
                    }}
                  >
                    {info.label}
                  </span>
                  {isConflict && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blood-900/40 text-blood-300 border border-blood-500/30">
                      <AlertTriangle size={12} />
                      冲突!
                    </span>
                  )}
                  <span className="text-gold-300 text-xs tabular-nums">AP:{cmd.cost}</span>
                  <span className="text-bone-400 text-xs flex-1 truncate">{cmd.description}</span>
                  <span className="text-bone-500 text-[10px] tabular-nums">优先级:{cmd.priority}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => reorderCommand(cmd.id, cmd.priority + 1000)}
                      className="btn-gothic px-1.5 py-1 text-xs"
                      title="提升优先级"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => reorderCommand(cmd.id, cmd.priority - 1000)}
                      className="btn-gothic px-1.5 py-1 text-xs"
                      title="降低优先级"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={() => removeCommand(cmd.id)}
                      className="btn-danger px-1.5 py-1 text-xs"
                      title="删除指令"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="card-abyss border-gold-glow rounded-lg p-5">
        <h2 className="font-serif text-lg font-bold text-gold-400 mb-4">⚖️ 回合清算</h2>

        {currentPhase === 'action' && commands.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-bone-300 text-sm">已提交 {commands.length} 条指令，可以进行冲突检测预览。</p>
            {resolvedOrder.length > 0 && (
              <div className="rounded-lg bg-abyss-600/30 border border-gold-500/10 px-4 py-3">
                <p className="text-gold-500 text-xs font-serif mb-2">执行顺序预览：</p>
                {resolvedOrder.map((cmd, i) => {
                  const info = COMMAND_TYPE_INFO[cmd.type]
                  return (
                    <div key={cmd.id} className="flex items-center gap-2 text-xs py-1">
                      <span className="text-bone-500 tabular-nums">{i + 1}.</span>
                      <span className="text-gold-400 font-serif">{cmd.playerName}</span>
                      <span style={{ color: info.color }}>{info.label}</span>
                      <span className="text-bone-500 truncate">{cmd.description}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={executeSettlement} className="btn-gothic self-end flex items-center gap-2">
              <Play size={16} />
              执行清算
            </button>
          </div>
        )}

        {currentPhase === 'action' && commands.length === 0 && (
          <p className="text-bone-500 text-sm">尚无指令，请先提交行动指令。</p>
        )}

        {currentPhase === 'settlement' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle size={20} />
              <span className="font-serif font-bold">结算已完成</span>
            </div>
            <p className="text-bone-300 text-sm">本回合指令已全部执行完毕，可以结束回合。</p>
            <button onClick={completeTurn} className="btn-gothic self-end">
              结束回合
            </button>
          </div>
        )}

        {currentPhase === 'complete' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-gold-400">
              <CheckCircle size={20} />
              <span className="font-serif font-bold">回合已结束</span>
            </div>
            <button onClick={startNewTurn} className="btn-gothic self-end">
              开始新回合
            </button>
          </div>
        )}

        {currentPhase === 'conflict' && (
          <div className="flex flex-col gap-3">
            <p className="text-bone-300 text-sm">冲突检测中，确认执行清算以处理冲突。</p>
            <button onClick={executeSettlement} className="btn-gothic self-end flex items-center gap-2">
              <Play size={16} />
              执行清算
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
