# Simulation Queue Management System

## Overview

The BDAT project now includes a comprehensive simulation queue management system that provides advanced control over simulation execution, including:

- **Queue Management**: Add simulations to a priority-based queue
- **Pause/Resume**: Pause running simulations and resume them later
- **Priority Control**: Set and change simulation priorities (LOW, NORMAL, HIGH, URGENT)
- **Real-time Monitoring**: WebSocket-based status updates
- **Concurrent Execution**: Control maximum concurrent simulations

## Architecture

### Backend Components

1. **SimulationQueueManager** (`simulation_queue_manager.py`)
   - Core queue management logic
   - Priority-based queue with automatic processing
   - Thread-safe operations
   - WebSocket callback system

2. **Enhanced Services** (`simulations_service.py`)
   - New queue management service functions
   - Integration with existing simulation flow
   - WebSocket notifications

3. **API Endpoints** (`simulations_controller.py`)
   - RESTful endpoints for queue operations
   - Consistent error handling

### Frontend Components

1. **Enhanced SimulationService** (`simulationService.js`)
   - Queue management API calls
   - Updated status mapping
   - Progress tracking

2. **QueueManager Component** (`QueueManager.jsx`)
   - Real-time queue visualization
   - Interactive controls
   - Status monitoring

## API Endpoints

### Queue Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/simulations/{id}/queue` | Add simulation to queue |
| `DELETE` | `/simulations/{id}/queue` | Remove simulation from queue |
| `PUT` | `/simulations/{id}/pause` | Pause running simulation |
| `PUT` | `/simulations/{id}/resume` | Resume paused simulation |
| `PUT` | `/simulations/{id}/priority` | Change simulation priority |
| `GET` | `/simulations/queue/status` | Get current queue status |

### Request/Response Examples

#### Add to Queue
```bash
PUT /simulations/123/queue
Content-Type: application/json

{
  "priority": "HIGH",
  "estimated_duration": 3600
}
```

Response:
```json
{
  "status": "success",
  "message": "Simulation 123 added to queue",
  "queue_position": 2,
  "priority": "HIGH",
  "queue_size": 5
}
```

#### Get Queue Status
```bash
GET /simulations/queue/status
```

Response:
```json
{
  "status": "success",
  "queue_status": {
    "queue": [
      {
        "id": 123,
        "priority": "HIGH",
        "created_at": "2024-01-01T12:00:00Z",
        "estimated_duration": 3600
      }
    ],
    "running": [
      {
        "id": 124,
        "state": "Running",
        "start_time": "2024-01-01T11:30:00Z",
        "progress": 0.45,
        "current_step": "Mesh generation"
      }
    ],
    "paused": [],
    "queue_size": 1,
    "running_count": 1,
    "paused_count": 0,
    "max_concurrent": 2,
    "can_start_new": true
  }
}
```

## Simulation States

The system now supports enhanced simulation states:

| State | Description |
|-------|-------------|
| `Not started` | Simulation created but not queued |
| `Queued` | Waiting in queue for execution |
| `Running` | Currently executing |
| `Paused` | Execution paused by user |
| `Resuming` | Transitioning from paused to running |
| `Aborting` | Being terminated by user request |
| `Aborted` | Terminated by user |
| `Finished` | Completed successfully |
| `Error` | Failed due to error |
| `Failed` | Failed validation or other issues |

## Priority Levels

Simulations can be assigned different priority levels:

| Priority | Value | Description |
|----------|-------|-------------|
| `URGENT` | 4 | Highest priority, executes first |
| `HIGH` | 3 | High priority |
| `NORMAL` | 2 | Default priority |
| `LOW` | 1 | Lowest priority |

## Usage Examples

### Backend Usage

```python
from features.simulations.services.simulation_queue_manager import queue_manager, SimulationPriority

# Add simulation to queue
success = queue_manager.add_to_queue(
    simulation_id=123,
    parameters=simulation_params,
    priority=SimulationPriority.HIGH,
    estimated_duration=3600
)

# Pause simulation
success = queue_manager.pause_simulation(123)

# Resume simulation
success = queue_manager.resume_simulation(123)

# Get queue status
status = queue_manager.get_queue_status()
```

### Frontend Usage

```javascript
import simulationService from './simulationService';

// Add to queue with high priority
const result = await simulationService.queueSimulation(123, 'HIGH', 3600);

// Pause simulation
const pauseResult = await simulationService.pauseSimulation(123);

// Resume simulation
const resumeResult = await simulationService.resumeSimulation(123);

// Change priority
const priorityResult = await simulationService.changePriority(123, 'URGENT');

// Get queue status
const queueStatus = await simulationService.getQueueStatus();
```

### React Component Usage

```jsx
import QueueManager from './features/simulations/QueueManager';

function App() {
  return (
    <div>
      <QueueManager />
    </div>
  );
}
```

## WebSocket Events

The system emits real-time WebSocket events for queue updates:

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `simulation_status_update` | Simulation state changed | `{simulation_id, state, message}` |
| `simulation_progress_update` | Progress updated | `{simulation_id, progress, current_step, estimated_remaining}` |
| `simulation_queue_update` | Queue changed | `{action, simulation_id, queue_size, position}` |

### Frontend WebSocket Handling

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Listen for queue updates
socket.on('simulation_queue_update', (data) => {
  console.log('Queue updated:', data);
  // Update UI accordingly
});

// Listen for status updates
socket.on('simulation_status_update', (data) => {
  console.log('Status updated:', data);
  // Update simulation status in UI
});

// Listen for progress updates
socket.on('simulation_progress_update', (data) => {
  console.log('Progress updated:', data);
  // Update progress bar
});
```

## Configuration

### Queue Manager Settings

The queue manager can be configured in `simulation_queue_manager.py`:

```python
# Maximum concurrent simulations
queue_manager = SimulationQueueManager(max_concurrent_simulations=2)

# Set callbacks for WebSocket notifications
queue_manager.set_callback('status_update', status_callback)
queue_manager.set_callback('progress_update', progress_callback)
queue_manager.set_callback('queue_update', queue_callback)

# Start processing
queue_manager.start_processing()
```

### App Initialization

The queue manager is automatically initialized in `app.py`:

```python
# Initialize queue manager after app context is available
with app.app_context():
    try:
        from features.simulations.services.simulations_service import setup_queue_manager
        setup_queue_manager()
        print("✅ Queue manager initialized successfully")
    except Exception as e:
        print(f"⚠️ Warning: Could not initialize queue manager: {e}")
```

## Error Handling

The system includes comprehensive error handling:

### Backend Errors

- **Validation Errors**: Invalid priority values, simulation not found
- **State Errors**: Cannot pause non-running simulation, etc.
- **Concurrency Errors**: Thread-safe operations with proper locking

### Frontend Errors

- **Network Errors**: Connection issues, timeout handling
- **API Errors**: Server error responses with user-friendly messages
- **Validation Errors**: Client-side validation before API calls

## Monitoring and Debugging

### Logging

The system provides detailed logging:

```python
# Queue manager logs
print("✅ Queue manager initialized successfully")
print(f"🔄 Starting simulation {sim_id} from queue")
print(f"⏸️ Simulation {sim_id} paused by user request")
print(f"🧹 Cleaned up finished simulation {sim_id}")
```

### Debug Information

Access debug information via:

- Queue status endpoint: `/simulations/queue/status`
- WebSocket events in browser console
- Server logs for detailed execution flow

## Best Practices

### Queue Management

1. **Use appropriate priorities**: Reserve URGENT for critical simulations
2. **Estimate durations**: Provide estimated duration for better scheduling
3. **Monitor queue size**: Avoid overwhelming the system
4. **Handle errors gracefully**: Always check return values

### Performance

1. **Limit concurrent simulations**: Based on system resources
2. **Use WebSocket updates**: For real-time UI updates
3. **Batch operations**: When possible, batch multiple queue operations
4. **Clean up resources**: Ensure proper cleanup of finished simulations

### User Experience

1. **Provide feedback**: Show queue position and estimated wait time
2. **Allow cancellation**: Users should be able to remove from queue
3. **Show progress**: Real-time progress updates for running simulations
4. **Handle failures**: Clear error messages and recovery options

## Troubleshooting

### Common Issues

1. **Queue not processing**: Check if queue manager is initialized
2. **WebSocket not working**: Verify SocketIO configuration
3. **Simulations stuck**: Check for abort/pause requests
4. **Priority not working**: Verify priority enum values

### Debug Steps

1. Check server logs for initialization messages
2. Verify WebSocket connection in browser console
3. Test API endpoints directly with curl/Postman
4. Monitor queue status endpoint for state changes

## Future Enhancements

Potential improvements for the queue system:

1. **Persistent Queue**: Save queue state to database
2. **Resource Management**: CPU/memory-based scheduling
3. **User Quotas**: Limit simulations per user
4. **Advanced Scheduling**: Time-based scheduling, dependencies
5. **Metrics Dashboard**: Queue performance analytics
6. **Email Notifications**: Completion notifications
7. **API Rate Limiting**: Prevent queue flooding
8. **Simulation Templates**: Pre-configured simulation types
