import React, { useState } from 'react';
import './TipManagementPanel.css';
import { toast } from '../lib/toast.js';

export default function TipManagementPanel({ 
  tipManager, 
  machinePosition, 
  isConnected,
  onWriteSerial
}) {
  const [activeTab, setActiveTab] = useState('tips');
  
  // Local state for slots config
  const [tempSlotCount, setTempSlotCount] = useState(tipManager.slotCount || 4);

  // Local state for Change Tip form
  const [changeTargetId, setChangeTargetId] = useState('');

  const activeTip = tipManager.tips.find(t => t.id === tipManager.activeTipId);

  const handleApplySlots = () => {
    tipManager.setSlotCount(tempSlotCount);
  };

  const handleSavePosition = (index) => {
    if (!machinePosition) {
      toast.error('Machine position unknown. Ensure machine is connected and homed.');
      return;
    }
    tipManager.calibrateSlot(index, machinePosition);
  };

  const handleExecuteChange = async () => {
    if (!isConnected) {
      toast.error('Machine not connected.');
      return;
    }
    await tipManager.executeTipChange(tipManager.activeTipId, changeTargetId, onWriteSerial);
  };

  return (
    <div className="tip-management-panel">
      <h2 className="panel-title">🔧 TIP MANAGEMENT</h2>

      {/* Banner */}
      <div className="status-banner">
        <div className="active-tip-name">
          {activeTip ? activeTip.name : 'No tip installed'}
        </div>
        <div className={`status-badge ${tipManager.status.toLowerCase()}`}>
          {tipManager.status}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          Tips
        </button>
        <button 
          className={`tab-btn ${activeTab === 'change' ? 'active' : ''}`}
          onClick={() => setActiveTab('change')}
        >
          Change Tip
        </button>
        <button 
          className={`tab-btn ${activeTab === 'calibrate' ? 'active' : ''}`}
          onClick={() => setActiveTab('calibrate')}
        >
          Calibrate Slots
        </button>
      </div>

      {/* TABS CONTENT */}
      
      {activeTab === 'tips' && (
        <div className="tab-content">
          <div className="add-tip-row">
            <button className="btn-add" onClick={tipManager.addTip}>
              + ADD TIP
            </button>
            <span className="tip-count">{tipManager.tips.length} tip(s) configured</span>
          </div>

          {tipManager.tips.length > 0 && (
            <div className="tips-list">
              <div className="tip-row-headers">
                <div>Name</div>
                <div>Type</div>
                <div>Slot</div>
                <div>Offset (dx,dy,dz)</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              
              {tipManager.tips.map(tip => (
                <div className="tip-row" key={tip.id}>
                  <input 
                    type="text" 
                    value={tip.name}
                    onChange={e => tipManager.updateTip(tip.id, { name: e.target.value })}
                  />
                  <select 
                    value={tip.type}
                    onChange={e => tipManager.updateTip(tip.id, { type: e.target.value })}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Fine">Fine</option>
                    <option value="Chisel">Chisel</option>
                    <option value="Bevel">Bevel</option>
                  </select>
                  <select
                    value={tip.slot || ''}
                    onChange={e => tipManager.updateTip(tip.id, { slot: e.target.value })}
                  >
                    <option value="">--</option>
                    {tipManager.slots.map(s => (
                      <option key={s.index} value={`Slot ${s.index}`}>Slot {s.index}</option>
                    ))}
                  </select>
                  
                  <div className="offset-group">
                    <div className="offset-input">
                      <span>DX</span>
                      <input 
                        type="number" 
                        value={tip.offsetX} 
                        onChange={e => tipManager.updateTip(tip.id, { offsetX: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="offset-input">
                      <span>DY</span>
                      <input 
                        type="number" 
                        value={tip.offsetY} 
                        onChange={e => tipManager.updateTip(tip.id, { offsetY: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="offset-input">
                      <span>DZ</span>
                      <input 
                        type="number" 
                        value={tip.offsetZ} 
                        onChange={e => tipManager.updateTip(tip.id, { offsetZ: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="tip-status">
                    {tipManager.activeTipId === tip.id ? 'Active' : '—'}
                  </div>

                  <div className="tip-actions">
                    <button className="btn-action">DONE</button>
                    <button 
                      className="btn-action" 
                      onClick={() => tipManager.setActiveTip(tip.id, 'VERIFIED')}
                    >
                      SET ACTIVE
                    </button>
                    <button 
                      className="btn-action btn-remove"
                      onClick={() => tipManager.removeTip(tip.id)}
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'change' && (
        <div className="tab-content">
          <div className="change-tip-grid">
            <div className="change-select-group">
              <label>CURRENT TIP (TO DROP)</label>
              <select disabled value={tipManager.activeTipId || ''}>
                <option value="">(No tip / skip drop)</option>
                {tipManager.tips.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (Slot {t.slot})</option>
                ))}
              </select>
            </div>
            
            <div className="arrow-icon">→</div>
            
            <div className="change-select-group">
              <label>TARGET TIP (TO PICK UP)</label>
              <select 
                value={changeTargetId} 
                onChange={e => setChangeTargetId(e.target.value)}
              >
                <option value="">— Select tip —</option>
                {tipManager.tips.filter(t => t.id !== tipManager.activeTipId).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <button 
              className="btn-change"
              onClick={handleExecuteChange}
              disabled={tipManager.status === 'CHANGING'}
            >
              🔧 CHANGE TIP
            </button>
          </div>
        </div>
      )}

      {activeTab === 'calibrate' && (
        <div className="tab-content">
          <div className="slots-header">
            <label>NUMBER OF SLOTS:</label>
            <input 
              type="number" 
              value={tempSlotCount} 
              onChange={e => setTempSlotCount(parseInt(e.target.value) || 4)} 
              min="4" max="20"
            />
            <button className="btn-apply" onClick={handleApplySlots}>APPLY</button>
            <span style={{color: '#8b949e', fontSize: '0.8rem'}}>Min 4, max 20</span>
          </div>

          <div className="slots-grid">
            {tipManager.slots.map(slot => {
              const assignedTip = tipManager.tips.find(t => t.slot === `Slot ${slot.index}`);
              return (
                <div className="slot-card" key={slot.index}>
                  <div className="slot-card-header">
                    <h4>Slot {slot.index}</h4>
                    <span className={`slot-status ${slot.position ? 'set' : 'not-set'}`}>
                      {slot.position ? '○ Set' : '○ Not set'}
                    </span>
                  </div>
                  
                  <div className="slot-assign">
                    <label>ASSIGNED TIP</label>
                    <select 
                      value={assignedTip ? assignedTip.id : ''}
                      onChange={e => {
                        if (e.target.value) {
                          tipManager.updateTip(e.target.value, { slot: `Slot ${slot.index}` });
                        }
                      }}
                    >
                      <option value="">— None —</option>
                      {tipManager.tips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    className="btn-save-pos"
                    onClick={() => handleSavePosition(slot.index)}
                  >
                    📍 SAVE POSITION
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

