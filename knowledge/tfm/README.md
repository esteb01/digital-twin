# Real-Time Robotic Trajectory Evaluation via Surrogate Models and Deep Latent Representations

> **(TFM)** | Master in Applied Artificial Intelligence
> - **Author:** Esteban Ruiz Hernández
> - **Supervisor:** Carlos Cernuda

Official title of the submitted thesis. Digital twin here is only a short gloss for the surrogate-model system, not the heading.

Repository: https://github.com/esteb01/TFM_Surrogate_Robot
Grade: 9.1/10

## Project Description

This project addresses real-time motion planning in high-dimensional dynamic environments.

High-fidelity physical simulations (such as PyBullet) are accurate but computationally expensive (~50ms per evaluation), preventing their use for evaluating thousands of candidate trajectories in real-time. This TFM implements surrogate models to predict the viability, energy cost, and collision risk of a trajectory in microseconds.

### Key Features

- Physical simulation ground truth in PyBullet with a 7-DoF KUKA IIWA manipulator
- Trajectories with 350 dimensions (7 joints × 50 steps)
- Deep autoencoder for nonlinear dimensionality reduction (350D → 16D latent)
- Benchmark: Neural Networks (DNN), Physics-Guided Neural Networks (PINN), Kriging, SVR, and RBF
- Optuna hyperparameter tuning
- Multi-task prediction of cost (regression) and collision (classification)
- Streamlit interface for visualization

## Results (4,000 unseen test samples)

| Model | R² Score | Recall (Safety) | Speedup vs physics |
| Neural Network (Multi-Task) | 0.933 | 90.2% | ~1250x (up to 17,301x single-trajectory) |
| PINN (Physics-Guided) | 0.891 | 94.0% | ~1250x |
| Kriging | 0.878 | 92.2% | ~40x |
| SVR | 0.869 | 94.8% | ~830x |
| RBF | 0.850 | 92.8% | ~10x |

Single-trajectory evaluation went from 63 ms to 0.004 ms (17,301x). SMAPE of the multi-task network: 2.28%.
PINN raised collision detection recall from 90.2% to 94.0%.
