"""
Simulation Queue Manager
Manages simulation queue, priorities, pause/resume, and execution flow
"""

import threading
import time
import queue
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import json

class SimulationState(Enum):
    """Enhanced simulation states"""
    NOT_STARTED = "Not started"
    QUEUED = "Queued"
    RUNNING = "Running"
    PAUSED = "Paused"
    RESUMING = "Resuming"
    ABORTING = "Aborting"
    ABORTED = "Aborted"
    FINISHED = "Finished"
    ERROR = "Error"
    FAILED = "Failed"

class SimulationPriority(Enum):
    """Simulation priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4

@dataclass
class QueuedSimulation:
    """Represents a simulation in the queue"""
    id: int
    priority: SimulationPriority
    parameters: Dict[str, Any]
    created_at: datetime = field(default_factory=datetime.now)
    estimated_duration: Optional[int] = None  # seconds
    user_id: Optional[str] = None
    
    def __lt__(self, other):
        """For priority queue ordering (higher priority first, then FIFO)"""
        if self.priority.value != other.priority.value:
            return self.priority.value > other.priority.value
        return self.created_at < other.created_at

@dataclass
class RunningSimulation:
    """Represents a currently running simulation"""
    id: int
    thread: threading.Thread
    start_time: datetime
    state: SimulationState
    abort_requested: bool = False
    pause_requested: bool = False
    resume_requested: bool = False
    progress: float = 0.0  # 0.0 to 1.0
    current_step: str = ""
    estimated_remaining: Optional[int] = None  # seconds
    
class SimulationQueueManager:
    """
    Manages simulation queue, execution, and state transitions
    """
    
    def __init__(self, max_concurrent_simulations: int = 2):
        self.max_concurrent = max_concurrent_simulations
        self.simulation_queue = queue.PriorityQueue()
        self.running_simulations: Dict[int, RunningSimulation] = {}
        self.paused_simulations: Dict[int, RunningSimulation] = {}
        self.queue_lock = threading.Lock()
        self.running_lock = threading.Lock()
        self.is_processing = False
        self.processor_thread = None
        self.callbacks = {
            'status_update': None,
            'progress_update': None,
            'queue_update': None
        }
        
    def set_callback(self, event_type: str, callback_func):
        """Set callback functions for events"""
        if event_type in self.callbacks:
            self.callbacks[event_type] = callback_func
    
    def start_processing(self):
        """Start the queue processor thread"""
        if not self.is_processing:
            self.is_processing = True
            self.processor_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.processor_thread.start()
    
    def stop_processing(self):
        """Stop the queue processor thread"""
        self.is_processing = False
        if self.processor_thread:
            self.processor_thread.join(timeout=5)
    
    def add_to_queue(self, simulation_id: int, parameters: Dict[str, Any], 
                     priority: SimulationPriority = SimulationPriority.NORMAL,
                     estimated_duration: Optional[int] = None) -> bool:
        """Add a simulation to the queue"""
        try:
            with self.queue_lock:
                queued_sim = QueuedSimulation(
                    id=simulation_id,
                    priority=priority,
                    parameters=parameters,
                    estimated_duration=estimated_duration
                )
                self.simulation_queue.put(queued_sim)
                
            self._notify_callback('queue_update', {
                'action': 'added',
                'simulation_id': simulation_id,
                'queue_size': self.get_queue_size(),
                'position': self._get_queue_position(simulation_id)
            })
            
            # Update positions for all simulations in queue
            self._update_queue_positions()
            
            return True
        except Exception as e:
            print(f"❌ Error adding simulation {simulation_id} to queue: {e}")
            return False
    
    def remove_from_queue(self, simulation_id: int) -> bool:
        """Remove a simulation from the queue"""
        try:
            with self.queue_lock:
                # Create a new queue without the target simulation
                temp_queue = queue.PriorityQueue()
                removed = False
                
                while not self.simulation_queue.empty():
                    try:
                        sim = self.simulation_queue.get_nowait()
                        if sim.id != simulation_id:
                            temp_queue.put(sim)
                        else:
                            removed = True
                    except queue.Empty:
                        break
                
                self.simulation_queue = temp_queue
                
            if removed:
                self._notify_callback('queue_update', {
                    'action': 'removed',
                    'simulation_id': simulation_id,
                    'queue_size': self.get_queue_size()
                })
                
                # Update positions for remaining simulations in queue
                self._update_queue_positions()
            
            return removed
        except Exception as e:
            print(f"❌ Error removing simulation {simulation_id} from queue: {e}")
            return False
    
    def pause_simulation(self, simulation_id: int) -> bool:
        """Request to pause a running simulation"""
        try:
            with self.running_lock:
                if simulation_id in self.running_simulations:
                    sim = self.running_simulations[simulation_id]
                    if sim.state == SimulationState.RUNNING:
                        sim.pause_requested = True
                        sim.state = SimulationState.PAUSED
                        
                        # Move to paused simulations
                        self.paused_simulations[simulation_id] = sim
                        del self.running_simulations[simulation_id]
                        
                        self._notify_callback('status_update', {
                            'simulation_id': simulation_id,
                            'state': SimulationState.PAUSED.value,
                            'message': 'Simulation paused by user request'
                        })
                        
                        return True
            return False
        except Exception as e:
            print(f"❌ Error pausing simulation {simulation_id}: {e}")
            return False
    
    def resume_simulation(self, simulation_id: int) -> bool:
        """Resume a paused simulation"""
        try:
            with self.running_lock:
                if simulation_id in self.paused_simulations:
                    sim = self.paused_simulations[simulation_id]
                    sim.resume_requested = True
                    sim.pause_requested = False
                    sim.state = SimulationState.RESUMING
                    
                    # Move back to running simulations
                    self.running_simulations[simulation_id] = sim
                    del self.paused_simulations[simulation_id]
                    
                    self._notify_callback('status_update', {
                        'simulation_id': simulation_id,
                        'state': SimulationState.RESUMING.value,
                        'message': 'Resuming simulation'
                    })
                    
                    return True
            return False
        except Exception as e:
            print(f"❌ Error resuming simulation {simulation_id}: {e}")
            return False
    
    def abort_simulation(self, simulation_id: int) -> bool:
        """Abort a running or paused simulation"""
        try:
            with self.running_lock:
                # Check running simulations
                if simulation_id in self.running_simulations:
                    sim = self.running_simulations[simulation_id]
                    sim.abort_requested = True
                    sim.state = SimulationState.ABORTING
                    
                    self._notify_callback('status_update', {
                        'simulation_id': simulation_id,
                        'state': SimulationState.ABORTING.value,
                        'message': 'Aborting simulation'
                    })
                    return True
                
                # Check paused simulations
                if simulation_id in self.paused_simulations:
                    sim = self.paused_simulations[simulation_id]
                    sim.abort_requested = True
                    sim.state = SimulationState.ABORTING
                    
                    # Move to running for cleanup
                    self.running_simulations[simulation_id] = sim
                    del self.paused_simulations[simulation_id]
                    
                    self._notify_callback('status_update', {
                        'simulation_id': simulation_id,
                        'state': SimulationState.ABORTING.value,
                        'message': 'Aborting paused simulation'
                    })
                    return True
            
            # Also try to remove from queue
            return self.remove_from_queue(simulation_id)
            
        except Exception as e:
            print(f"❌ Error aborting simulation {simulation_id}: {e}")
            return False
    
    def update_progress(self, simulation_id: int, progress: float, 
                       current_step: str = "", estimated_remaining: Optional[int] = None):
        """Update simulation progress"""
        try:
            with self.running_lock:
                if simulation_id in self.running_simulations:
                    sim = self.running_simulations[simulation_id]
                    sim.progress = max(0.0, min(1.0, progress))
                    sim.current_step = current_step
                    sim.estimated_remaining = estimated_remaining
                    
                    self._notify_callback('progress_update', {
                        'simulation_id': simulation_id,
                        'progress': sim.progress,
                        'current_step': sim.current_step,
                        'estimated_remaining': sim.estimated_remaining
                    })
        except Exception as e:
            print(f"❌ Error updating progress for simulation {simulation_id}: {e}")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        try:
            with self.queue_lock, self.running_lock:
                queue_list = []
                temp_queue = queue.PriorityQueue()
                
                # Extract queue items to list
                while not self.simulation_queue.empty():
                    try:
                        sim = self.simulation_queue.get_nowait()
                        queue_list.append({
                            'id': sim.id,
                            'priority': sim.priority.name,
                            'created_at': sim.created_at.isoformat(),
                            'estimated_duration': sim.estimated_duration
                        })
                        temp_queue.put(sim)
                    except queue.Empty:
                        break
                
                # Restore queue
                self.simulation_queue = temp_queue
                
                # Sort by priority and creation time for display
                queue_list.sort(key=lambda x: (
                    -SimulationPriority[x['priority']].value,
                    x['created_at']
                ))
                
                running_list = []
                for sim_id, sim in self.running_simulations.items():
                    running_list.append({
                        'id': sim_id,
                        'state': sim.state.value,
                        'start_time': sim.start_time.isoformat(),
                        'progress': sim.progress,
                        'current_step': sim.current_step,
                        'estimated_remaining': sim.estimated_remaining
                    })
                
                paused_list = []
                for sim_id, sim in self.paused_simulations.items():
                    paused_list.append({
                        'id': sim_id,
                        'state': sim.state.value,
                        'start_time': sim.start_time.isoformat(),
                        'progress': sim.progress,
                        'current_step': sim.current_step
                    })
                
                return {
                    'queue': queue_list,
                    'running': running_list,
                    'paused': paused_list,
                    'queue_size': len(queue_list),
                    'running_count': len(running_list),
                    'paused_count': len(paused_list),
                    'max_concurrent': self.max_concurrent,
                    'can_start_new': len(running_list) < self.max_concurrent
                }
        except Exception as e:
            print(f"❌ Error getting queue status: {e}")
            return {
                'queue': [], 'running': [], 'paused': [],
                'queue_size': 0, 'running_count': 0, 'paused_count': 0,
                'max_concurrent': self.max_concurrent, 'can_start_new': False
            }
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        return self.simulation_queue.qsize()
    
    def get_running_count(self) -> int:
        """Get count of running simulations"""
        with self.running_lock:
            return len(self.running_simulations)
    
    def change_priority(self, simulation_id: int, new_priority: SimulationPriority) -> bool:
        """Change priority of a queued simulation"""
        try:
            with self.queue_lock:
                # Find and remove the simulation
                temp_queue = queue.PriorityQueue()
                target_sim = None
                
                while not self.simulation_queue.empty():
                    try:
                        sim = self.simulation_queue.get_nowait()
                        if sim.id == simulation_id:
                            target_sim = sim
                            sim.priority = new_priority
                        temp_queue.put(sim)
                    except queue.Empty:
                        break
                
                self.simulation_queue = temp_queue
                
                if target_sim:
                    self._notify_callback('queue_update', {
                        'action': 'priority_changed',
                        'simulation_id': simulation_id,
                        'new_priority': new_priority.name,
                        'position': self._get_queue_position(simulation_id)
                    })
                    
                    # Update positions for all simulations after priority change
                    self._update_queue_positions()
                    return True
                    
            return False
        except Exception as e:
            print(f"❌ Error changing priority for simulation {simulation_id}: {e}")
            return False
    
    def _process_queue(self):
        """Main queue processing loop"""
        while self.is_processing:
            try:
                # Check if we can start new simulations
                with self.running_lock:
                    can_start = len(self.running_simulations) < self.max_concurrent
                
                if can_start and not self.simulation_queue.empty():
                    try:
                        # Get next simulation from queue
                        queued_sim = self.simulation_queue.get(timeout=1)
                        
                        # Create running simulation entry
                        running_sim = RunningSimulation(
                            id=queued_sim.id,
                            thread=None,  # Will be set when actual execution starts
                            start_time=datetime.now(),
                            state=SimulationState.RUNNING
                        )
                        
                        with self.running_lock:
                            self.running_simulations[queued_sim.id] = running_sim
                        
                        self._notify_callback('status_update', {
                            'simulation_id': queued_sim.id,
                            'state': SimulationState.RUNNING.value,
                            'message': 'Starting simulation from queue'
                        })
                        
                        # Notify about queue change
                        self._notify_callback('queue_update', {
                            'action': 'started',
                            'simulation_id': queued_sim.id,
                            'queue_size': self.get_queue_size()
                        })
                        
                        # Update queue positions for remaining simulations
                        self._update_queue_positions()
                        
                    except queue.Empty:
                        pass
                
                # Clean up finished simulations
                self._cleanup_finished_simulations()
                
                time.sleep(1)  # Check every second
                
            except Exception as e:
                print(f"❌ Error in queue processor: {e}")
                time.sleep(5)  # Wait longer on error
    
    def _cleanup_finished_simulations(self):
        """Remove finished simulations from tracking"""
        try:
            with self.running_lock:
                finished_ids = []
                for sim_id, sim in self.running_simulations.items():
                    if sim.state in [SimulationState.FINISHED, SimulationState.ABORTED, 
                                   SimulationState.ERROR, SimulationState.FAILED]:
                        finished_ids.append(sim_id)
                
                for sim_id in finished_ids:
                    del self.running_simulations[sim_id]
                    print(f"🧹 Cleaned up finished simulation {sim_id}")
        except Exception as e:
            print(f"❌ Error cleaning up finished simulations: {e}")
    
    def _get_queue_position(self, simulation_id: int) -> int:
        """Get position of simulation in queue (1-based)"""
        try:
            position = 1
            temp_queue = queue.PriorityQueue()
            found_position = -1
            
            # Extract all items and find position
            items = []
            while not self.simulation_queue.empty():
                try:
                    sim = self.simulation_queue.get_nowait()
                    items.append(sim)
                    temp_queue.put(sim)
                except queue.Empty:
                    break
            
            # Sort items by priority
            items.sort()
            
            for i, sim in enumerate(items):
                if sim.id == simulation_id:
                    found_position = i + 1
                    break
            
            # Restore queue
            self.simulation_queue = temp_queue
            
            return found_position
        except Exception:
            return -1
    
    def _update_queue_positions(self):
        """Update queue positions for all queued simulations and notify via WebSocket"""
        try:
            # Get all simulations currently in queue
            temp_queue = queue.PriorityQueue()
            items = []
            
            while not self.simulation_queue.empty():
                try:
                    sim = self.simulation_queue.get_nowait()
                    items.append(sim)
                    temp_queue.put(sim)
                except queue.Empty:
                    break
            
            # Restore queue
            self.simulation_queue = temp_queue
            
            # Sort items by priority to get correct positions
            items.sort()
            
            # Notify each simulation of its new position
            from ..services.simulations_service import notificar_estado_simulacion
            for position, sim in enumerate(items, start=1):
                notificar_estado_simulacion(sim.id, 'Queued', queue_position=position)
                print(f"📊 Updated queue position for sim {sim.id}: position {position}")
                
        except Exception as e:
            print(f"❌ Error updating queue positions: {e}")
    
    def _notify_callback(self, event_type: str, data: Dict[str, Any]):
        """Notify registered callbacks"""
        try:
            if self.callbacks.get(event_type):
                self.callbacks[event_type](data)
        except Exception as e:
            print(f"❌ Error in callback {event_type}: {e}")

# Global queue manager instance
queue_manager = SimulationQueueManager()
