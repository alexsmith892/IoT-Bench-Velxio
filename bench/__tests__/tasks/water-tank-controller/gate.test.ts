import task from '../../../tasks/water-tank-controller/task';
import { registerStandardTaskGateTests } from '../../helpers/taskGateSuite';

registerStandardTaskGateTests(task, { timeoutMs: 240_000 });
