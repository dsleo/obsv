import unittest

import numpy as np

from calibrate_complete_communes import solve_kl


class CalibrateCompleteCommunesTest(unittest.TestCase):
    def test_matches_shares_without_erasing_prior_odds_differences(self):
        prior = np.array([[.1, .05, .7, .15], [.1, .05, .15, .7]])
        mass = np.array([.6, .4])
        target = np.array([.2, .05, .45, .3])
        result, residual = solve_kl(prior, target, mass)
        self.assertLess(residual, 1e-8)
        np.testing.assert_allclose(mass @ result, target, atol=1e-8)
        prior_difference = np.log(prior[0, 2] / prior[0, 3]) - np.log(prior[1, 2] / prior[1, 3])
        final_difference = np.log(result[0, 2] / result[0, 3]) - np.log(result[1, 2] / result[1, 3])
        self.assertAlmostEqual(prior_difference, final_difference, places=8)
        self.assertGreater(result[0, 2], result[1, 2])


if __name__ == "__main__":
    unittest.main()
